// src/app/api/cenabast/diagnostico/route.ts
// Endpoint para diagnosticar qué datos se están filtrando antes de enviar a Mirth

import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";

export const runtime = "nodejs";

function parseDateOnly(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * GET /api/cenabast/diagnostico?tipo=stock&fecha=2024-12-09
 * GET /api/cenabast/diagnostico?tipo=movimiento&fecha=2024-12-09&tipoMov=E
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo") || "stock";
    const fechaParam = searchParams.get("fecha");
    const tipoMov = searchParams.get("tipoMov") || "E"; // E o S

    const pool = await getPool();

    if (tipo === "stock") {
      // Determinar fecha a usar
      let fecha: string;
      if (fechaParam) {
        fecha = fechaParam;
      } else {
        const ultimaFechaResult = await pool.request().query(`
          SELECT TOP 1 CONVERT(VARCHAR(10), fechaCorte, 23) AS fechaCorte
          FROM TBL_existencias_cenabast
          WHERE existencia > 0
          GROUP BY fechaCorte
          ORDER BY fechaCorte DESC
        `);
        fecha = ultimaFechaResult.recordset[0]?.fechaCorte;
      }

      if (!fecha) {
        return NextResponse.json({
          error: "No hay datos de existencias en la base de datos",
        });
      }

      // DIAGNÓSTICO COMPLETO
      const diagnostico = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT
            'Total registros en fecha' AS categoria,
            COUNT(*) AS cantidad,
            NULL AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha

          UNION ALL

          SELECT
            'Con stock > 0' AS categoria,
            COUNT(*) AS cantidad,
            NULL AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0

          UNION ALL

          SELECT
            'codigo IS NULL (filtro 2)' AS categoria,
            COUNT(*) AS cantidad,
            NULL AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0
            AND codigo IS NULL

          UNION ALL

          SELECT
            'codigo_zgen IS NULL (filtro 3a)' AS categoria,
            COUNT(*) AS cantidad,
            NULL AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0
            AND codigo IS NOT NULL
            AND codigo_zgen IS NULL

          UNION ALL

          SELECT
            'codigo_zgen vacío o espacios (filtro 3b)' AS categoria,
            COUNT(*) AS cantidad,
            NULL AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0
            AND codigo IS NOT NULL
            AND codigo_zgen IS NOT NULL
            AND LTRIM(RTRIM(codigo_zgen)) = ''

          UNION ALL

          SELECT
            'codigo_zgen NO NUMÉRICO (filtro 3c)' AS categoria,
            COUNT(*) AS cantidad,
            NULL AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0
            AND codigo IS NOT NULL
            AND codigo_zgen IS NOT NULL
            AND LTRIM(RTRIM(codigo_zgen)) != ''
            AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL

          UNION ALL

          SELECT
            '✅ APROBADOS para enviar a CENABAST' AS categoria,
            COUNT(*) AS cantidad,
            NULL AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0
            AND codigo IS NOT NULL
            AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NOT NULL
        `);

      // Ejemplos de productos RECHAZADOS
      const ejemplosRechazados = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT TOP 20
            codigo,
            codigo_zgen,
            existencia,
            descripcion,
            CASE
              WHEN codigo IS NULL THEN 'codigo IS NULL'
              WHEN codigo_zgen IS NULL THEN 'codigo_zgen IS NULL'
              WHEN LTRIM(RTRIM(codigo_zgen)) = '' THEN 'codigo_zgen vacío'
              WHEN TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL THEN 'codigo_zgen no numérico'
              ELSE 'Desconocido'
            END AS razon_rechazo
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0
            AND (
              codigo IS NULL
              OR codigo_zgen IS NULL
              OR LTRIM(RTRIM(codigo_zgen)) = ''
              OR TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL
            )
          ORDER BY existencia DESC
        `);

      // Ejemplos de productos APROBADOS
      const ejemplosAprobados = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT TOP 10
            codigo AS codigo_interno,
            TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) AS codigo_generico,
            existencia AS cantidad_stock,
            descripcion AS descripcion_producto
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND codigo IS NOT NULL
            AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NOT NULL
            AND existencia > 0
          ORDER BY existencia DESC
        `);

      // Payload que se enviaría
      const payloadCompleto = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT
            e.codigo AS codigo_interno,
            TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT) AS codigo_generico,
            SUM(e.existencia) AS cantidad_stock,
            MAX(e.descripcion) AS descripcion_producto
          FROM TBL_existencias_cenabast e
          WHERE e.fechaCorte = @fecha
            AND e.codigo IS NOT NULL
            AND TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT) IS NOT NULL
            AND e.existencia > 0
          GROUP BY e.codigo, e.codigo_zgen
        `);

      return NextResponse.json({
        tipo: "STOCK",
        fecha,
        resumen: diagnostico.recordset,
        productos_rechazados: {
          total: ejemplosRechazados.recordset.length,
          ejemplos: ejemplosRechazados.recordset,
        },
        productos_aprobados: {
          total: payloadCompleto.recordset.length,
          ejemplos: ejemplosAprobados.recordset,
        },
        payload_que_se_enviaria: {
          id_relacion: Number(process.env.CENABAST_ID_RELACION || 1),
          fecha_stock: fecha,
          stock_detalle: payloadCompleto.recordset.map((r: any) => ({
            codigo_interno: String(r.codigo_interno),
            codigo_generico: Number(r.codigo_generico) || 0,
            cantidad_stock: Number(r.cantidad_stock) || 0,
            codigo_despacho: 0,
            descripcion_producto: r.descripcion_producto || "",
          })),
        },
      });
    } else if (tipo === "movimiento") {
      const fecha = fechaParam || new Date().toISOString().split("T")[0];

      // DIAGNÓSTICO MOVIMIENTOS
      const diagnostico = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT
            'Total movimientos en fecha' AS categoria,
            COUNT(*) AS cantidad
          FROM TBL_movimientos_cenabast
          WHERE CAST(fechaMovimiento AS DATE) = @fecha

          UNION ALL

          SELECT
            '${tipoMov === "E" ? "Entradas (cantidad > 0)" : "Salidas (cantidad < 0)"}' AS categoria,
            COUNT(*) AS cantidad
          FROM TBL_movimientos_cenabast
          WHERE CAST(fechaMovimiento AS DATE) = @fecha
            AND ${tipoMov === "E" ? "cantidad > 0" : "cantidad < 0"}

          UNION ALL

          SELECT
            'codigo IS NULL (filtro 3)' AS categoria,
            COUNT(*) AS cantidad
          FROM TBL_movimientos_cenabast
          WHERE CAST(fechaMovimiento AS DATE) = @fecha
            AND ${tipoMov === "E" ? "cantidad > 0" : "cantidad < 0"}
            AND codigo IS NULL

          UNION ALL

          SELECT
            'codigo_zgen IS NULL (filtro 4)' AS categoria,
            COUNT(*) AS cantidad
          FROM TBL_movimientos_cenabast
          WHERE CAST(fechaMovimiento AS DATE) = @fecha
            AND ${tipoMov === "E" ? "cantidad > 0" : "cantidad < 0"}
            AND codigo IS NOT NULL
            AND codigo_zgen IS NULL

          UNION ALL

          SELECT
            '✅ APROBADOS para enviar a CENABAST' AS categoria,
            COUNT(*) AS cantidad
          FROM TBL_movimientos_cenabast
          WHERE CAST(fechaMovimiento AS DATE) = @fecha
            AND ${tipoMov === "E" ? "cantidad > 0" : "cantidad < 0"}
            AND codigo IS NOT NULL
            AND codigo_zgen IS NOT NULL
        `);

      // Ejemplos rechazados
      const ejemplosRechazados = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT TOP 20
            codigo,
            codigo_zgen,
            cantidad,
            numero_lote,
            fechaMovimiento,
            CASE
              WHEN codigo IS NULL THEN 'codigo IS NULL'
              WHEN codigo_zgen IS NULL THEN 'codigo_zgen IS NULL'
              ELSE 'Desconocido'
            END AS razon_rechazo
          FROM TBL_movimientos_cenabast
          WHERE CAST(fechaMovimiento AS DATE) = @fecha
            AND ${tipoMov === "E" ? "cantidad > 0" : "cantidad < 0"}
            AND (codigo IS NULL OR codigo_zgen IS NULL)
          ORDER BY ABS(cantidad) DESC
        `);

      // Payload completo
      const payloadCompleto = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT
            m.codigo AS codigo_interno,
            CAST(m.codigo_zgen AS INT) AS codigo_generico,
            ${tipoMov === "E" ? "m.cantidad" : "ABS(m.cantidad)"} AS cantidad,
            m.numero_lote AS lote,
            CONVERT(VARCHAR(10), m.vencimiento, 23) AS fecha_vencimiento,
            m.rut AS rut_proveedor,
            m.numero AS nro_factura,
            0 AS codigo_despacho
          FROM TBL_movimientos_cenabast m
          WHERE ${tipoMov === "E" ? "m.cantidad > 0" : "m.cantidad < 0"}
            AND CAST(m.fechaMovimiento AS DATE) = @fecha
            AND m.codigo IS NOT NULL
            AND m.codigo_zgen IS NOT NULL
        `);

      return NextResponse.json({
        tipo: "MOVIMIENTO",
        tipo_movimiento: tipoMov === "E" ? "ENTRADA" : "SALIDA",
        fecha,
        resumen: diagnostico.recordset,
        movimientos_rechazados: {
          total: ejemplosRechazados.recordset.length,
          ejemplos: ejemplosRechazados.recordset,
        },
        movimientos_aprobados: {
          total: payloadCompleto.recordset.length,
        },
        payload_que_se_enviaria: {
          id_relacion: Number(process.env.CENABAST_ID_RELACION || 1),
          fecha_movimiento: fecha,
          tipo_movimiento: tipoMov,
          tipo_compra: "C",
          movimiento_detalle: payloadCompleto.recordset.map((row: any) => ({
            codigo_interno: String(row.codigo_interno),
            codigo_generico: Number(row.codigo_generico) || 0,
            cantidad: Number(row.cantidad) || 0,
            lote: row.lote || null,
            fecha_vencimiento: row.fecha_vencimiento || null,
            rut_proveedor: row.rut_proveedor ? Number(row.rut_proveedor) : null,
            nro_factura: row.nro_factura ? Number(row.nro_factura) : null,
            codigo_despacho: 0,
          })),
        },
      });
    }

    return NextResponse.json({ error: "Tipo no válido. Usa ?tipo=stock o ?tipo=movimiento" });
  } catch (err: any) {
    console.error("[diagnostico] Error:", err);
    return NextResponse.json(
      { error: { message: err.message } },
      { status: 500 }
    );
  }
}
