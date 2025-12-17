import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { getValidToken } from "@/lib/cenabast-token";
import { isValidDateFormat, toSqlDate, sanitizeSqlDate, getDateDiagnostic } from "@/lib/date-validator";
import { parseMirthError, formatMirthErrorForLog } from "@/lib/mirth-error-handler";
import { transformarMovimientoParaCenabast } from "@/lib/cenabast-transform";

const MIRTH_HOST = process.env.MIRTH_HOST || "10.7.71.64";
const MIRTH_PORT_MOVIMIENTO = 6664;

function parseDateOnly(dateStr: string) {
  // Soporta YYYY-MM-DD (backend) y DD-MM-YYYY (picker de UI)
  const ymd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  const dmy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  // Fallback: confiar en Date
  return new Date(dateStr);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[API] Body recibido:", JSON.stringify(body, null, 2));

    const { id_relacion, fecha_movimiento, tipo_movimiento, tipo_compra } = body;

    if (!id_relacion || !fecha_movimiento || !tipo_movimiento || !tipo_compra) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: id_relacion, fecha_movimiento, tipo_movimiento, tipo_compra" },
        { status: 400 }
      );
    }

    const tokenInfo = await getValidToken();
    const token = tokenInfo?.token;
    if (!token) {
      return NextResponse.json(
        { error: "No se pudo obtener token de autenticación" },
        { status: 401 }
      );
    }

    const pool = await getPool();

    // Ajustar 1 día hacia atrás para el envío (CENABAST trabaja con día previo)
    const selectedDate = parseDateOnly(fecha_movimiento);
    const adjustedDate = new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000);
    const fechaAjustada = toSqlDate(adjustedDate);
    if (!fechaAjustada) {
      return NextResponse.json(
        { error: { message: "Fecha de movimiento inválida tras ajuste -1 día" } },
        { status: 400 }
      );
    }

    // Verificar si hay datos en la fecha ajustada
    let fechaUsada = fechaAjustada;
    console.log("[API] Verificando datos para fecha seleccionada:", fecha_movimiento, "-> fecha enviada:", fechaUsada, "tipo:", tipo_movimiento);

    const checkResult = await pool.request()
      .input("fecha", sql.Date, parseDateOnly(fechaUsada))
      .query(`
        SELECT COUNT(*) AS total
        FROM TBL_movimientos_cenabast
        WHERE CAST(fechaMovimiento AS DATE) = @fecha
          AND ${tipo_movimiento === "E" ? "cantidad > 0" : "cantidad < 0"}
      `);

    if (checkResult.recordset[0].total === 0) {
      console.log("[API] No hay movimientos en", fechaUsada, "- Buscando última fecha...");

      // Buscar última fecha con movimientos
      const ultimaFechaResult = await pool.request().query(`
        SELECT TOP 1
          CONVERT(VARCHAR(10), fechaMovimiento, 23) AS fechaMovimiento,
          COUNT(*) AS total
        FROM TBL_movimientos_cenabast
        WHERE ${tipo_movimiento === "E" ? "cantidad > 0" : "cantidad < 0"}
        GROUP BY CAST(fechaMovimiento AS DATE)
        ORDER BY CAST(fechaMovimiento AS DATE) DESC
      `);

      if (ultimaFechaResult.recordset.length === 0) {
        console.log("[API] No hay movimientos de tipo", tipo_movimiento, "en la base de datos");
        return NextResponse.json({
          success: true,
          message: `No hay movimientos de tipo ${tipo_movimiento === "E" ? "entrada" : "salida"} en la base de datos`,
          count: 0,
        });
      }

      fechaUsada = ultimaFechaResult.recordset[0].fechaMovimiento;
      console.log("[API] Usando última fecha:", fechaUsada, "con", ultimaFechaResult.recordset[0].total, "registros");
    } else {
      console.log("[API] Fecha válida con", checkResult.recordset[0].total, "registros");
    }

    // FILTROS APLICADOS (requeridos por normativa):
    // 1. tipoDocumento IN ('Factura','Guia Despacho') - Solo documentos válidos para CENABAST
    // 2. RUT <> '11-101' - Excluir movimientos internos del Hospital del Carmen
    const diagResult = await pool.request()
      .input("fecha", sql.Date, parseDateOnly(fechaUsada))
      .query(`
        SELECT
          total = COUNT(*),
          permitidos_tipo = SUM(CASE WHEN tipoDocumento IN ('Factura','Guia Despacho') THEN 1 ELSE 0 END),
          excluidos_rut = SUM(CASE WHEN ISNULL(rut,'') = '11-101' THEN 1 ELSE 0 END),
          permitidos_final = SUM(CASE WHEN tipoDocumento IN ('Factura','Guia Despacho') AND ISNULL(rut,'') <> '11-101' THEN 1 ELSE 0 END)
        FROM TBL_movimientos_cenabast
        WHERE ${tipo_movimiento === "E" ? "cantidad > 0" : "cantidad < 0"}
          AND CAST(fechaMovimiento AS DATE) = @fecha
      `);

    const diag = diagResult.recordset[0] || { total: 0, permitidos_tipo: 0, excluidos_rut: 0, permitidos_final: 0 };
    console.log("[API] Diagnóstico de filtros:", JSON.stringify({
      fecha: fechaUsada,
      tipo: tipo_movimiento === "E" ? "Entrada" : "Salida",
      total_movimientos: diag.total,
      con_tipo_valido_factura_guia: diag.permitidos_tipo,
      movimientos_internos_rut_11101: diag.excluidos_rut,
      validos_para_enviar_cenabast: diag.permitidos_final,
      nota: "Movimientos internos (RUT 11-101) NO se reportan a CENABAST"
    }, null, 2));

    // Query principal: obtener movimientos válidos para CENABAST
    // IMPORTANTE: Los filtros son obligatorios por normativa
    const query = `
      SELECT
        ISNULL(m.codigo, '') AS codigo_interno,
        ISNULL(TRY_CAST(m.codigo_zgen AS INT), 0) AS codigo_generico,
        ${tipo_movimiento === "E" ? "m.cantidad" : "ABS(m.cantidad)"} AS cantidad,
        m.numero_lote AS lote,
        CONVERT(VARCHAR(10), m.vencimiento, 23) AS fecha_vencimiento,
        m.tipoDocumento,
        m.numero AS nro_doc,
        m.rut AS rut_proveedor,
        0 AS codigo_despacho
      FROM TBL_movimientos_cenabast m
      WHERE ${tipo_movimiento === "E" ? "m.cantidad > 0" : "m.cantidad < 0"}
        AND CAST(m.fechaMovimiento AS DATE) = @fecha
        -- Solo Factura o Guía de Despacho (requerimiento CENABAST)
        AND m.tipoDocumento IN ('Factura','Guia Despacho')
        -- Excluir movimientos internos del Hospital del Carmen
        AND ISNULL(m.rut,'') <> '11-101'
    `;

    const result = await pool.request()
      .input("fecha", sql.Date, parseDateOnly(fechaUsada))
      .query(query);

    console.log("[API] Registros encontrados:", result.recordset.length);

    if (result.recordset.length === 0) {
      // Mensaje más descriptivo indicando por qué no hay movimientos
      const tipoDescripcion = tipo_movimiento === "E" ? "entradas" : "salidas";
      let mensaje = `No hay movimientos de ${tipoDescripcion} para reportar a CENABAST en esta fecha`;

      if (diag.excluidos_rut > 0) {
        mensaje += `. Se encontraron ${diag.excluidos_rut} movimientos internos del hospital (RUT 11-101) que no se reportan a CENABAST`;
      }

      if (diag.total > 0 && diag.permitidos_tipo === 0) {
        mensaje += `. Hay ${diag.total} movimientos pero no son de tipo Factura o Guía de Despacho`;
      }

      return NextResponse.json({
        success: true,
        message: mensaje,
        count: 0,
        diagnostico: {
          total_movimientos: diag.total,
          con_tipo_valido: diag.permitidos_tipo,
          internos_excluidos: diag.excluidos_rut,
          validos_para_enviar: diag.permitidos_final,
          fecha_consultada: fechaUsada,
          tipo_movimiento: tipo_movimiento === "E" ? "Entrada" : "Salida",
        }
      });
    }

    // Validar fecha_movimiento antes de enviar
    if (!isValidDateFormat(fechaUsada)) {
      const diagnostic = getDateDiagnostic(fechaUsada);
      console.error("[API] fecha_movimiento inválida:", diagnostic);

      return NextResponse.json({
        success: false,
        error: {
          message: "Fecha de movimiento inválida",
          details: diagnostic,
        }
      }, { status: 400 });
    }

    // Sanitizar fecha para SQL
    const fechaSanitizada = toSqlDate(fechaUsada);
    if (!fechaSanitizada) {
      return NextResponse.json({
        success: false,
        error: {
          message: "No se pudo convertir fecha_movimiento a formato SQL válido",
          fecha_original: fechaUsada,
        }
      }, { status: 400 });
    }

    // Preparar datos SIN transformar (para diagnóstico)
    const movimientoDataRaw = {
      id_relacion: Number(id_relacion),
      fecha_movimiento: fechaSanitizada,
      tipo_movimiento,
      tipo_compra,
      movimiento_detalle: result.recordset.map((row: any) => {
        // Sanitizar fecha_vencimiento (puede ser NULL)
        const fechaVencimiento = sanitizeSqlDate(row.fecha_vencimiento);

        // Determinar tipo de documento
        const esGuia = row.tipoDocumento === "Guia Despacho";

        // Si había fecha pero es inválida, registrar warning
        if (row.fecha_vencimiento && !fechaVencimiento) {
          console.warn("[API] fecha_vencimiento inválida para producto:", row.codigo_interno, "fecha:", row.fecha_vencimiento);
        }

        return {
          codigo_interno: row.codigo_interno,
          codigo_generico: row.codigo_generico,
          cantidad: row.cantidad,
          lote: row.lote,
          fecha_vencimiento: fechaVencimiento,
          rut_proveedor: row.rut_proveedor,
          nro_doc: row.nro_doc,
          nro_factura: !esGuia ? row.nro_doc : undefined,
          nro_guia_despacho: esGuia ? row.nro_doc : undefined,
          codigo_despacho: row.codigo_despacho,
          codigo_gtin: row.codigo_gtin,
        };
      }),
    };

    // TRANSFORMAR según especificación CENABAST v1.9
    // Esto corrige:
    // - codigo_generico: convierte a int (NO puede ser 0)
    // - rut_proveedor: limpia DV y convierte a int (ej: "96519830-K" → 96519830)
    // - nro_factura: convierte a int
    // - nro_guia_despacho: convierte a int
    // - codigo_despacho: omite si es 0
    const transformacion = transformarMovimientoParaCenabast(movimientoDataRaw);

    // Si hay errores críticos, no enviar
    if (transformacion.errores.length > 0) {
      console.error("[API] Errores de validación:", transformacion.errores);
      return NextResponse.json({
        success: false,
        error: {
          message: "Errores de validación en los datos",
          errores: transformacion.errores,
          warnings: transformacion.warnings,
        }
      }, { status: 400 });
    }

    // Mostrar warnings si los hay
    if (transformacion.warnings.length > 0) {
      console.warn("[API] Warnings de validación:", transformacion.warnings);
    }

    const movimientoData = transformacion.data;

    console.log("[API] Enviando a Mirth:", JSON.stringify(movimientoData, null, 2));

    const mirthUrl = `http://${MIRTH_HOST}:${MIRTH_PORT_MOVIMIENTO}/cenabast/movimiento`;
    const bodyString = JSON.stringify(movimientoData);

    const mirthResponse = await fetch(mirthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: bodyString,
    });

    const mirthResponseText = await mirthResponse.text();
    console.log("[API] Mirth response:", mirthResponse.status, mirthResponseText);

    let mirthData: any;
    try {
      mirthData = JSON.parse(mirthResponseText);
    } catch {
      mirthData = { message: mirthResponseText };
    }

    // Manejar respuesta con error
    if (!mirthResponse.ok) {
      const parsedError = parseMirthError(mirthData);
      console.error("[API] Error parseado:", formatMirthErrorForLog(parsedError));

      return NextResponse.json({
        success: false,
        error: {
          tipo: parsedError.tipo,
          message: parsedError.mensaje,
          detalles: parsedError.detalles,
          sugerencias: parsedError.sugerencias,
          esRecuperable: parsedError.esRecuperable,
        }
      }, { status: mirthResponse.status });
    }

    // Verificar si el payload indica error (statusCode 500, isSuccessful: false)
    if (mirthData?.statusCode && !mirthData?.isSuccessful) {
      const parsedError = parseMirthError(mirthData);
      console.error("[API] Error en respuesta exitosa:", formatMirthErrorForLog(parsedError));

      return NextResponse.json({
        success: false,
        error: {
          tipo: parsedError.tipo,
          message: parsedError.mensaje,
          detalles: parsedError.detalles,
          sugerencias: parsedError.sugerencias,
          esRecuperable: parsedError.esRecuperable,
        },
        response: mirthData,
      }, { status: mirthData.statusCode || 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Movimientos informados correctamente",
      count: result.recordset.length,
      fecha_usada: fechaSanitizada,
      response: mirthData,
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}





