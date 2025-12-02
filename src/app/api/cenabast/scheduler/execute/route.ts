// src/app/api/cenabast/scheduler/execute/route.ts
// Ejecución de tareas programadas (cron job y manual)

import { NextResponse, NextRequest } from "next/server";
import { getPool, sql } from "@/lib/db";
import { getValidToken } from "@/lib/cenabast-token";

export const runtime = "nodejs";

const MIRTH_HOST = process.env.MIRTH_HOST || "10.7.71.64";
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
    // Obtener stock consolidado
    const stockResult = await pool.request()
      .input("idRelacion", sql.Int, tarea.id_relacion || 1)
      .query(`
        SELECT 
          codigo,
          SUM(stock_actual) AS cantidad
        FROM TBL_existencias_cenabast
        WHERE activo = 1
        GROUP BY codigo
      `);

    if (stockResult.recordset.length === 0) {
      return { items: 0, error: "No hay stock para enviar" };
    }

    const items = stockResult.recordset.map((row: any) => ({
      codigoProducto: row.codigo,
      cantidad: row.cantidad,
    }));

    // Enviar a Mirth
    const res = await fetch(`http://${MIRTH_HOST}:6663/cenabast/stock/informar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        idRelacion: tarea.id_relacion || 1,
        items,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { items: items.length, error: errorData?.error || `Error HTTP ${res.status}` };
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
    
    const movResult = await pool.request()
      .input("tipo", sql.Char(1), tipo)
      .input("fecha", sql.Date, hoy)
      .query(`
        SELECT *
        FROM TBL_movimientos_cenabast
        WHERE tipo_movimiento = @tipo
          AND CAST(fechaMovimiento AS DATE) = @fecha
          AND enviado_cenabast = 0
      `);

    if (movResult.recordset.length === 0) {
      return { items: 0, error: "No hay movimientos pendientes" };
    }

    const items = movResult.recordset.map((row: any) => ({
      codigoProducto: row.codigo,
      cantidad: row.cantidad,
      lote: row.lote,
      fechaVencimiento: row.fechaVencimiento,
      tipoCompra: tarea.tipo_compra || "C",
    }));

    const endpoint = tipo === "E" ? "entrada" : "salida";
    const res = await fetch(`http://${MIRTH_HOST}:6664/cenabast/movimiento/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        idRelacion: tarea.id_relacion || 1,
        items,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { items: items.length, error: errorData?.error || `Error HTTP ${res.status}` };
    }

    // Marcar como enviados
    await pool.request()
      .input("tipo", sql.Char(1), tipo)
      .input("fecha", sql.Date, hoy)
      .query(`
        UPDATE TBL_movimientos_cenabast 
        SET enviado_cenabast = 1, fecha_envio = GETDATE()
        WHERE tipo_movimiento = @tipo AND CAST(fechaMovimiento AS DATE) = @fecha
      `);

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
        idRelacion: tarea.id_relacion || 1,
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
        id_relacion: id_relacion || 1,
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
