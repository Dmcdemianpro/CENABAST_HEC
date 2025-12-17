// src/app/api/cenabast/scheduler/execute/route.ts
// Ejecución de tareas programadas (cron job y manual)

import { NextResponse, NextRequest } from "next/server";
import { getPool, sql } from "@/lib/db";
import { getValidToken } from "@/lib/cenabast-token";
import { toSqlDate, sanitizeSqlDate } from "@/lib/date-validator";
import { parseMirthError, formatMirthErrorForLog } from "@/lib/mirth-error-handler";

export const runtime = "nodejs";

const MIRTH_HOST = process.env.MIRTH_HOST || "10.7.71.64";
const DEFAULT_ID_RELACION = Number(process.env.CENABAST_ID_RELACION || 286);
const CRON_SECRET = process.env.CRON_SECRET || "cenabast-cron-secret";

// Crear tablas si no existen
async function ensureTables(pool: any) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TBL_cenabast_scheduler' AND xtype='U')
      CREATE TABLE TBL_cenabast_scheduler (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(100) NOT NULL,
        tipo NVARCHAR(50) NOT NULL,
        activo BIT DEFAULT 1,
        hora_ejecucion NVARCHAR(5) NOT NULL,
        dias_semana NVARCHAR(20) DEFAULT '1,2,3,4,5',
        id_relacion INT NULL,
        tipo_compra CHAR(1) NULL,
        ultima_ejecucion DATETIME NULL,
        proxima_ejecucion DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TBL_cenabast_scheduler_log' AND xtype='U')
      CREATE TABLE TBL_cenabast_scheduler_log (
        id INT IDENTITY(1,1) PRIMARY KEY,
        scheduler_id INT NULL,
        tipo NVARCHAR(50) NOT NULL,
        modo NVARCHAR(20) DEFAULT 'MANUAL',
        estado NVARCHAR(20) DEFAULT 'PENDIENTE',
        fecha_inicio DATETIME DEFAULT GETDATE(),
        fecha_fin DATETIME NULL,
        items_enviados INT DEFAULT 0,
        items_error INT DEFAULT 0,
        mensaje NVARCHAR(MAX) NULL,
        detalle_respuesta NVARCHAR(MAX) NULL,
        usuario NVARCHAR(100) DEFAULT 'system'
      );
    `);
  } catch (err) {
    console.error("Error creando tablas:", err);
  }
}

/**
 * Calcular próxima ejecución
 */
function calcularProximaEjecucion(hora: string, diasSemana: string): Date {
  const [horaNum, minNum] = hora.split(":").map(Number);
  const diasArray = diasSemana.split(",").map(Number);
  const ahora = new Date();
  
  for (let i = 0; i < 8; i++) {
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() + i);
    fecha.setHours(horaNum, minNum, 0, 0);
    
    let diaSemana = fecha.getDay();
    if (diaSemana === 0) diaSemana = 7;
    
    if (diasArray.includes(diaSemana)) {
      if (i === 0 && fecha <= ahora) continue;
      return fecha;
    }
  }
  
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  manana.setHours(horaNum, minNum, 0, 0);
  return manana;
}

/**
 * Ejecutar envío de stock
 */
async function ejecutarStock(pool: any, tarea: any, token: string): Promise<{ items: number; error?: string }> {
  try {
    // Obtener stock consolidado - SIN FILTROS según guía CENABAST v1.9
    const stockResult = await pool.request()
      .input("idRelacion", sql.Int, tarea.id_relacion || DEFAULT_ID_RELACION)
      .query(`
        SELECT
          ISNULL(e.codigo, '') AS codigo_interno,
          ISNULL(TRY_CAST(e.codigo_zgen AS INT), 0) AS codigo_generico,
          SUM(e.existencia) AS cantidad_stock,
          0 AS codigo_despacho,
          MAX(e.descripcion) AS descripcion_producto
        FROM TBL_existencias_cenabast e
        WHERE e.fechaCorte = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast)
        GROUP BY e.codigo, e.codigo_zgen
        HAVING SUM(e.existencia) > 0
      `);

    if (stockResult.recordset.length === 0) {
      return { items: 0, error: "No hay stock para enviar" };
    }

    const items = stockResult.recordset.map((row: any) => ({
      codigo_interno: row.codigo_interno,
      codigo_generico: Number(row.codigo_generico) || 0,
      cantidad_stock: Number(row.cantidad_stock) || 0,
      codigo_despacho: 0,
      descripcion_producto: row.descripcion_producto || "",
    }));

    // Obtener y validar fecha
    const fechaHoy = toSqlDate(new Date());
    if (!fechaHoy) {
      return { items: 0, error: "Error generando fecha actual válida" };
    }

    // Enviar a Mirth
    const res = await fetch(`http://${MIRTH_HOST}:6663/cenabast/stock/informar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        id_relacion: tarea.id_relacion || DEFAULT_ID_RELACION,
        fecha_stock: fechaHoy,
        stock_detalle: items,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseData = await res.json().catch(() => ({}));

    // Verificar si el payload indica error interno
    if (responseData?.statusCode && !responseData?.isSuccessful) {
      const parsedError = parseMirthError(responseData);
      console.error("[scheduler/stock] Error en respuesta:", formatMirthErrorForLog(parsedError));
      return { items: items.length, error: parsedError.mensaje };
    }

    if (!res.ok) {
      const parsedError = parseMirthError(responseData);
      console.error("[scheduler/stock] Error HTTP:", formatMirthErrorForLog(parsedError));
      return { items: items.length, error: parsedError.mensaje || `Error HTTP ${res.status}` };
    }

    return { items: items.length };
  } catch (err: any) {
    return { items: 0, error: err.message || "Error ejecutando stock" };
  }
}

/**
 * Ejecutar envío de movimiento
 */
async function ejecutarMovimiento(pool: any, tarea: any, token: string, tipo: "E" | "S"): Promise<{ items: number; error?: string }> {
  try {
    const hoy = new Date().toISOString().split("T")[0];
    
    // FILTROS APLICADOS (requeridos por normativa):
    // 1. tipoDocumento IN ('Factura','Guia Despacho') - Solo documentos válidos para CENABAST
    // 2. RUT <> '11-101' - Excluir movimientos internos del Hospital del Carmen
    const diagResult = await pool.request()
      .input("tipo", sql.Char(1), tipo)
      .input("fecha", sql.Date, hoy)
      .query(`
        SELECT
          total = COUNT(*),
          permitidos_tipo = SUM(CASE WHEN tipoDocumento IN ('Factura','Guia Despacho') THEN 1 ELSE 0 END),
          excluidos_rut = SUM(CASE WHEN ISNULL(rut,'') = '11-101' THEN 1 ELSE 0 END),
          permitidos_final = SUM(CASE WHEN tipoDocumento IN ('Factura','Guia Despacho') AND ISNULL(rut,'') <> '11-101' THEN 1 ELSE 0 END)
        FROM TBL_movimientos_cenabast
        WHERE ${tipo === "E" ? "cantidad > 0" : "cantidad < 0"}
          AND CAST(fechaMovimiento AS DATE) = @fecha
      `);

    const diag = diagResult.recordset[0] || { total: 0, permitidos_tipo: 0, excluidos_rut: 0, permitidos_final: 0 };
    console.log("[scheduler/movimiento] Diagnóstico de filtros:", JSON.stringify({
      fecha: hoy,
      tipo: tipo === "E" ? "Entrada" : "Salida",
      total_movimientos: diag.total,
      con_tipo_valido_factura_guia: diag.permitidos_tipo,
      movimientos_internos_rut_11101: diag.excluidos_rut,
      validos_para_enviar_cenabast: diag.permitidos_final,
      nota: "Movimientos internos (RUT 11-101) NO se reportan a CENABAST"
    }, null, 2));

    // Query principal: obtener movimientos válidos para CENABAST
    // IMPORTANTE: Los filtros son obligatorios por normativa
    const movResult = await pool.request()
      .input("tipo", sql.Char(1), tipo)
      .input("fecha", sql.Date, hoy)
      .query(tipo === "E" ? `
        SELECT
          ISNULL(m.codigo, '') AS codigo_interno,
          ISNULL(TRY_CAST(m.codigo_zgen AS INT), 0) AS codigo_generico,
          m.cantidad AS cantidad,
          m.numero_lote AS lote,
          CONVERT(VARCHAR(10), m.vencimiento, 23) AS fecha_vencimiento,
          m.tipoDocumento,
          m.numero AS nro_doc,
          m.rut AS rut_proveedor,
          0 AS codigo_despacho
        FROM TBL_movimientos_cenabast m
        WHERE m.cantidad > 0
          AND CAST(m.fechaMovimiento AS DATE) = @fecha
          -- Solo Factura o Guía de Despacho (requerimiento CENABAST)
          AND m.tipoDocumento IN ('Factura','Guia Despacho')
          -- Excluir movimientos internos del Hospital del Carmen
          AND ISNULL(m.rut,'') <> '11-101'
      ` : `
        SELECT
          ISNULL(m.codigo, '') AS codigo_interno,
          ISNULL(TRY_CAST(m.codigo_zgen AS INT), 0) AS codigo_generico,
          ABS(m.cantidad) AS cantidad,
          m.numero_lote AS lote,
          CONVERT(VARCHAR(10), m.vencimiento, 23) AS fecha_vencimiento,
          m.tipoDocumento,
          m.numero AS nro_doc,
          m.rut AS rut_proveedor,
          0 AS codigo_despacho
        FROM TBL_movimientos_cenabast m
        WHERE m.cantidad < 0
          AND CAST(m.fechaMovimiento AS DATE) = @fecha
          -- Solo Factura o Guía de Despacho (requerimiento CENABAST)
          AND m.tipoDocumento IN ('Factura','Guia Despacho')
          -- Excluir movimientos internos del Hospital del Carmen
          AND ISNULL(m.rut,'') <> '11-101'
      `);

    if (movResult.recordset.length === 0) {
      // Mensaje más descriptivo
      const tipoDescripcion = tipo === "E" ? "entradas" : "salidas";
      let errorMsg = `No hay movimientos de ${tipoDescripcion} para reportar`;

      if (diag.excluidos_rut > 0) {
        errorMsg += ` (${diag.excluidos_rut} movimientos internos excluidos)`;
      }

      return { items: 0, error: errorMsg };
    }

    // Validar y sanitizar fecha
    const fechaHoy = toSqlDate(hoy);
    if (!fechaHoy) {
      return { items: 0, error: "Error generando fecha válida" };
    }

    const items = movResult.recordset.map((row: any) => {
      // Sanitizar fecha_vencimiento
      const fechaVencimiento = sanitizeSqlDate(row.fecha_vencimiento);

      const esGuia = row.tipoDocumento === "Guia Despacho";

      return {
        codigo_interno: row.codigo_interno,
        codigo_generico: Number(row.codigo_generico) || 0,
        cantidad: Number(row.cantidad) || 0,
        lote: row.lote || undefined,
        fecha_vencimiento: fechaVencimiento,
        rut_proveedor: row.rut_proveedor ? String(row.rut_proveedor) : undefined,
        nro_factura: !esGuia && row.nro_doc ? String(row.nro_doc) : undefined,
        nro_guia_despacho: esGuia && row.nro_doc ? String(row.nro_doc) : undefined,
        codigo_despacho: row.codigo_despacho != null ? Number(row.codigo_despacho) : 0,
        codigo_gtin: undefined,
      };
    });

    const res = await fetch(`http://${MIRTH_HOST}:6664/cenabast/movimiento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        id_relacion: tarea.id_relacion || DEFAULT_ID_RELACION,
        fecha_movimiento: fechaHoy,
        tipo_movimiento: tipo,
        tipo_compra: tarea.tipo_compra || "C",
        movimiento_detalle: items,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseData = await res.json().catch(() => ({}));

    // Verificar si el payload indica error interno
    if (responseData?.statusCode && !responseData?.isSuccessful) {
      const parsedError = parseMirthError(responseData);
      console.error("[scheduler/movimiento] Error en respuesta:", formatMirthErrorForLog(parsedError));
      return { items: items.length, error: parsedError.mensaje };
    }

    if (!res.ok) {
      const parsedError = parseMirthError(responseData);
      console.error("[scheduler/movimiento] Error HTTP:", formatMirthErrorForLog(parsedError));
      return { items: items.length, error: parsedError.mensaje || `Error HTTP ${res.status}` };
    }

    return { items: items.length };
  } catch (err: any) {
    return { items: 0, error: err.message || "Error ejecutando movimiento" };
  }
}

/**
 * Ejecutar sincronización de reglas
 */
async function ejecutarReglas(pool: any, tarea: any, token: string): Promise<{ items: number; error?: string }> {
  try {
    const reglasResult = await pool.request().query(`
      SELECT codigo, stock_minimo, stock_maximo
      FROM TBL_existencias_cenabast
      WHERE stock_minimo IS NOT NULL OR stock_maximo IS NOT NULL
      GROUP BY codigo, stock_minimo, stock_maximo
    `);

    if (reglasResult.recordset.length === 0) {
      return { items: 0, error: "No hay reglas para sincronizar" };
    }

    const items = reglasResult.recordset.map((row: any) => ({
      codigoProducto: row.codigo,
      stockMinimo: row.stock_minimo || 0,
      stockMaximo: row.stock_maximo || 0,
    }));

    const res = await fetch(`http://${MIRTH_HOST}:6663/cenabast/stock/reglas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        idRelacion: tarea.id_relacion || DEFAULT_ID_RELACION,
        reglas: items,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { items: items.length, error: errorData?.error || `Error HTTP ${res.status}` };
    }

    return { items: items.length };
  } catch (err: any) {
    return { items: 0, error: err.message || "Error ejecutando reglas" };
  }
}

/**
 * GET /api/cenabast/scheduler/execute - Ejecutar tareas pendientes (para cron)
 */
export async function GET(req: NextRequest) {
  try {
    // Verificar autorización
    const authHeader = req.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");
    
    if (providedSecret !== CRON_SECRET && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const pool = await getPool();
    await ensureTables(pool);

    // Buscar tareas pendientes de ejecutar
    const tareasResult = await pool.request().query(`
      SELECT * FROM TBL_cenabast_scheduler
      WHERE activo = 1 
        AND proxima_ejecucion IS NOT NULL
        AND proxima_ejecucion <= GETDATE()
    `);

    if (tareasResult.recordset.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay tareas pendientes",
        ejecutadas: 0,
      });
    }

    const tokenInfo = await getValidToken();
    const token = tokenInfo?.token;
    const resultados: any[] = [];

    for (const tarea of tareasResult.recordset) {
      // Crear log de inicio
      const logResult = await pool.request()
        .input("scheduler_id", sql.Int, tarea.id)
        .input("tipo", sql.NVarChar(50), tarea.tipo)
        .input("modo", sql.NVarChar(20), "AUTOMATICO")
        .input("estado", sql.NVarChar(20), "EJECUTANDO")
        .query(`
          INSERT INTO TBL_cenabast_scheduler_log (scheduler_id, tipo, modo, estado, fecha_inicio)
          OUTPUT INSERTED.id
          VALUES (@scheduler_id, @tipo, @modo, @estado, GETDATE())
        `);

      const logId = logResult.recordset[0].id;
      let resultado: { items: number; error?: string } = { items: 0 };

      try {
        if (!token) {
          resultado = { items: 0, error: "No hay token válido de CENABAST" };
        } else {
          switch (tarea.tipo) {
            case "STOCK":
              resultado = await ejecutarStock(pool, tarea, token);
              break;
            case "MOVIMIENTO_ENTRADA":
              resultado = await ejecutarMovimiento(pool, tarea, token, "E");
              break;
            case "MOVIMIENTO_SALIDA":
              resultado = await ejecutarMovimiento(pool, tarea, token, "S");
              break;
            case "REGLAS":
              resultado = await ejecutarReglas(pool, tarea, token);
              break;
            default:
              resultado = { items: 0, error: `Tipo desconocido: ${tarea.tipo}` };
          }
        }
      } catch (err: any) {
        resultado = { items: 0, error: err.message };
      }

      // Actualizar log con resultado
      await pool.request()
        .input("id", sql.Int, logId)
        .input("estado", sql.NVarChar(20), resultado.error ? "ERROR" : "COMPLETADO")
        .input("items_enviados", sql.Int, resultado.error ? 0 : resultado.items)
        .input("items_error", sql.Int, resultado.error ? resultado.items : 0)
        .input("mensaje", sql.NVarChar(sql.MAX), resultado.error || `${resultado.items} items procesados`)
        .query(`
          UPDATE TBL_cenabast_scheduler_log
          SET estado = @estado,
              fecha_fin = GETDATE(),
              items_enviados = @items_enviados,
              items_error = @items_error,
              mensaje = @mensaje
          WHERE id = @id
        `);

      // Actualizar próxima ejecución de la tarea
      const proximaEjecucion = calcularProximaEjecucion(tarea.hora_ejecucion, tarea.dias_semana);
      
      await pool.request()
        .input("id", sql.Int, tarea.id)
        .input("ultima", sql.DateTime, new Date())
        .input("proxima", sql.DateTime, proximaEjecucion)
        .query(`
          UPDATE TBL_cenabast_scheduler
          SET ultima_ejecucion = @ultima,
              proxima_ejecucion = @proxima,
              updated_at = GETDATE()
          WHERE id = @id
        `);

      resultados.push({
        tarea: tarea.nombre,
        tipo: tarea.tipo,
        exito: !resultado.error,
        items: resultado.items,
        error: resultado.error,
      });
    }

    return NextResponse.json({
      ok: true,
      ejecutadas: resultados.length,
      resultados,
    });
  } catch (err: any) {
    console.error("Error en GET /api/cenabast/scheduler/execute:", err);
    return NextResponse.json(
      { error: { message: err.message || "Error ejecutando tareas" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cenabast/scheduler/execute - Ejecutar tarea específica manualmente
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, tipo, id_relacion, tipo_compra } = body || {};

    const pool = await getPool();
    await ensureTables(pool);

    // Obtener tarea: por id o ad-hoc (tipo, id_relacion, tipo_compra)
    let tarea: any = null;
    if (id) {
      const tareaResult = await pool.request()
        .input("id", sql.Int, id)
        .query("SELECT * FROM TBL_cenabast_scheduler WHERE id = @id");

      tarea = tareaResult.recordset[0];
      if (!tarea) {
        return NextResponse.json(
          { error: { message: "Tarea no encontrada" } },
          { status: 404 }
        );
      }
    } else if (tipo) {
      tarea = {
        id: null,
        nombre: "Ejecución manual",
        tipo,
        id_relacion: id_relacion || DEFAULT_ID_RELACION,
        tipo_compra: tipo_compra || "C",
        hora_ejecucion: "00:00",
        dias_semana: "1,2,3,4,5,6,7",
        activo: true,
      };
    } else {
      return NextResponse.json(
        { error: { message: "Debe enviar id de tarea o tipo de ejecución" } },
        { status: 400 }
      );
    }

    const tokenInfo = await getValidToken();
    const token = tokenInfo?.token;

    // Crear log
    const logResult = await pool.request()
      .input("scheduler_id", sql.Int, tarea.id)
      .input("tipo", sql.NVarChar(50), tarea.tipo)
      .input("modo", sql.NVarChar(20), "MANUAL")
      .input("estado", sql.NVarChar(20), "EJECUTANDO")
      .query(`
        INSERT INTO TBL_cenabast_scheduler_log (scheduler_id, tipo, modo, estado, fecha_inicio)
        OUTPUT INSERTED.id
        VALUES (@scheduler_id, @tipo, @modo, @estado, GETDATE())
      `);

    const logId = logResult.recordset[0].id;
    let resultado: { items: number; error?: string } = { items: 0 };

    try {
      if (!token) {
        resultado = { items: 0, error: "No hay token válido de CENABAST. Autentíquese primero." };
      } else {
        switch (tarea.tipo) {
          case "STOCK":
            resultado = await ejecutarStock(pool, tarea, token);
            break;
          case "MOVIMIENTO_ENTRADA":
            resultado = await ejecutarMovimiento(pool, tarea, token, "E");
            break;
          case "MOVIMIENTO_SALIDA":
            resultado = await ejecutarMovimiento(pool, tarea, token, "S");
            break;
          case "REGLAS":
            resultado = await ejecutarReglas(pool, tarea, token);
            break;
          default:
            resultado = { items: 0, error: `Tipo desconocido: ${tarea.tipo}` };
        }
      }
    } catch (err: any) {
      resultado = { items: 0, error: err.message };
    }

    // Actualizar log
    await pool.request()
      .input("id", sql.Int, logId)
      .input("estado", sql.NVarChar(20), resultado.error ? "ERROR" : "COMPLETADO")
      .input("items_enviados", sql.Int, resultado.error ? 0 : resultado.items)
      .input("items_error", sql.Int, resultado.error ? resultado.items : 0)
      .input("mensaje", sql.NVarChar(sql.MAX), resultado.error || `${resultado.items} items procesados`)
      .query(`
        UPDATE TBL_cenabast_scheduler_log
        SET estado = @estado,
            fecha_fin = GETDATE(),
            items_enviados = @items_enviados,
            items_error = @items_error,
            mensaje = @mensaje
        WHERE id = @id
      `);

    // Actualizar tarea (solo si es una tarea registrada)
    if (tarea.id) {
      await pool.request()
        .input("id", sql.Int, tarea.id)
        .input("ultima", sql.DateTime, new Date())
        .query(`
          UPDATE TBL_cenabast_scheduler
          SET ultima_ejecucion = @ultima, updated_at = GETDATE()
          WHERE id = @id
        `);
    }

    if (resultado.error) {
      return NextResponse.json({
        ok: false,
        error: { message: resultado.error },
        items: resultado.items,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Tarea ejecutada: ${resultado.items} items procesados`,
      items: resultado.items,
    });
  } catch (err: any) {
    console.error("Error en POST /api/cenabast/scheduler/execute:", err);
    return NextResponse.json(
      { error: { message: err.message || "Error ejecutando tarea" } },
      { status: 500 }
    );
  }
}
