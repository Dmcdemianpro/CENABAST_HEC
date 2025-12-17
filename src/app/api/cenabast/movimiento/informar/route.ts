import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { getValidToken } from "@/lib/cenabast-token";
import { isValidDateFormat, toSqlDate, sanitizeSqlDate, getDateDiagnostic } from "@/lib/date-validator";
import { parseMirthError, formatMirthErrorForLog } from "@/lib/mirth-error-handler";

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

    // SIN FILTROS según guía CENABAST v1.9 - Enviar TODO
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
    console.log("[API] Filtros aplicados:", JSON.stringify({
      fecha: fechaUsada,
      tipo: tipo_movimiento,
      total: diag.total,
      permitidos_por_tipo: diag.permitidos_tipo,
      excluidos_por_rut: diag.excluidos_rut,
      para_enviar: diag.permitidos_final,
    }));

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
        AND m.tipoDocumento IN ('Factura','Guia Despacho')
        AND ISNULL(m.rut,'') <> '11-101'
    `;

    const result = await pool.request()
      .input("fecha", sql.Date, parseDateOnly(fechaUsada))
      .query(query);

    console.log("[API] Registros encontrados:", result.recordset.length);

    if (result.recordset.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay movimientos para informar en esta fecha",
        count: 0,
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

    // Preparar datos con sanitización de fechas
    const movimientoData = {
      id_relacion: Number(id_relacion),
      fecha_movimiento: fechaSanitizada,
      tipo_movimiento,
      tipo_compra,
      movimiento_detalle: result.recordset.map((row: any) => {
                // Sanitizar fecha_vencimiento (puede ser NULL)
        const fechaVencimiento = sanitizeSqlDate(row.fecha_vencimiento);

        const esGuia = row.tipoDocumento === "Guia Despacho";

        // Si había fecha pero es inválida, registrar warning
        if (row.fecha_vencimiento && !fechaVencimiento) {
          console.warn("[API] fecha_vencimiento inválida para producto:", row.codigo_interno, "fecha:", row.fecha_vencimiento);
        }

        return {
          codigo_interno: String(row.codigo_interno),
          codigo_generico: Number(row.codigo_generico) || 0,
          cantidad: Number(row.cantidad) || 0,
          lote: row.lote || undefined,
          fecha_vencimiento: fechaVencimiento, // undefined si es inválida
          rut_proveedor: row.rut_proveedor ? String(row.rut_proveedor) : undefined,
          nro_factura: !esGuia && row.nro_doc ? String(row.nro_doc) : undefined,
          nro_guia_despacho: esGuia && row.nro_doc ? String(row.nro_doc) : undefined,
          codigo_despacho: 0,
          codigo_gtin: undefined,
        };
      }),
    };

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





