// src/app/api/diagnostico-filtros/route.ts
// Endpoint PÚBLICO para diagnosticar qué datos se están filtrando antes de enviar a Mirth
// NO requiere autenticación - Solo para desarrollo/troubleshooting

import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";

export const runtime = "nodejs";

function parseDateOnly(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * GET /api/diagnostico-filtros?tipo=stock&fecha=2024-12-09
 * GET /api/diagnostico-filtros?tipo=movimiento&fecha=2024-12-09&tipoMov=E
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
            CAST(NULL AS NVARCHAR(MAX)) AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha

          UNION ALL

          SELECT
            'Con stock > 0' AS categoria,
            COUNT(*) AS cantidad,
            CAST(NULL AS NVARCHAR(MAX)) AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0

          UNION ALL

          SELECT
            '❌ FILTRO 2: codigo IS NULL' AS categoria,
            COUNT(*) AS cantidad,
            CAST(NULL AS NVARCHAR(MAX)) AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0
            AND codigo IS NULL

          UNION ALL

          SELECT
            '❌ FILTRO 3a: codigo_zgen IS NULL' AS categoria,
            COUNT(*) AS cantidad,
            CAST(NULL AS NVARCHAR(MAX)) AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0
            AND codigo IS NOT NULL
            AND codigo_zgen IS NULL

          UNION ALL

          SELECT
            '❌ FILTRO 3b: codigo_zgen vacío o espacios' AS categoria,
            COUNT(*) AS cantidad,
            CAST(NULL AS NVARCHAR(MAX)) AS ejemplos
          FROM TBL_existencias_cenabast
          WHERE fechaCorte = @fecha
            AND existencia > 0
            AND codigo IS NOT NULL
            AND codigo_zgen IS NOT NULL
            AND LTRIM(RTRIM(codigo_zgen)) = ''

          UNION ALL

          SELECT
            '❌ FILTRO 3c: codigo_zgen NO NUMÉRICO' AS categoria,
            COUNT(*) AS cantidad,
            CAST(NULL AS NVARCHAR(MAX)) AS ejemplos
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
            CAST(NULL AS NVARCHAR(MAX)) AS ejemplos
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
              WHEN codigo IS NULL THEN '❌ codigo IS NULL'
              WHEN codigo_zgen IS NULL THEN '❌ codigo_zgen IS NULL'
              WHEN LTRIM(RTRIM(codigo_zgen)) = '' THEN '❌ codigo_zgen vacío'
              WHEN TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL THEN '❌ codigo_zgen no numérico'
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

      // Contar totales para el payload
      const totalAprobados = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT COUNT(*) AS total
          FROM (
            SELECT
              e.codigo,
              e.codigo_zgen
            FROM TBL_existencias_cenabast e
            WHERE e.fechaCorte = @fecha
              AND e.codigo IS NOT NULL
              AND TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT) IS NOT NULL
              AND e.existencia > 0
            GROUP BY e.codigo, e.codigo_zgen
          ) AS subquery
        `);

      // Suma total de stock que se enviaría
      const sumaStock = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT
            SUM(e.existencia) AS stock_total
          FROM TBL_existencias_cenabast e
          WHERE e.fechaCorte = @fecha
            AND e.codigo IS NOT NULL
            AND TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT) IS NOT NULL
            AND e.existencia > 0
        `);

      return NextResponse.json({
        tipo: "STOCK",
        fecha,
        resumen_filtros: diagnostico.recordset,
        productos_rechazados: {
          total: ejemplosRechazados.recordset.length,
          ejemplos: ejemplosRechazados.recordset,
        },
        productos_aprobados: {
          total_productos: totalAprobados.recordset[0]?.total || 0,
          stock_total: sumaStock.recordset[0]?.stock_total || 0,
          ejemplos_top_10: ejemplosAprobados.recordset,
        },
        explicacion: {
          mensaje: "Los productos aprobados son los que SÍ se enviarán a CENABAST",
          filtros_aplicados: [
            "✅ fechaCorte debe coincidir con la fecha solicitada",
            "✅ existencia > 0 (tiene stock)",
            "❌ codigo IS NOT NULL (se pierden productos sin código)",
            "❌ codigo_zgen debe ser convertible a número entero (se pierden códigos alfanuméricos, NULL, vacíos)",
          ],
          nota: "Si el total de productos aprobados es MENOR de lo esperado, revisa los productos_rechazados para ver qué se está filtrando",
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
            '❌ FILTRO 3: codigo IS NULL' AS categoria,
            COUNT(*) AS cantidad
          FROM TBL_movimientos_cenabast
          WHERE CAST(fechaMovimiento AS DATE) = @fecha
            AND ${tipoMov === "E" ? "cantidad > 0" : "cantidad < 0"}
            AND codigo IS NULL

          UNION ALL

          SELECT
            '❌ FILTRO 4: codigo_zgen IS NULL' AS categoria,
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
              WHEN codigo IS NULL THEN '❌ codigo IS NULL'
              WHEN codigo_zgen IS NULL THEN '❌ codigo_zgen IS NULL'
              ELSE 'Desconocido'
            END AS razon_rechazo
          FROM TBL_movimientos_cenabast
          WHERE CAST(fechaMovimiento AS DATE) = @fecha
            AND ${tipoMov === "E" ? "cantidad > 0" : "cantidad < 0"}
            AND (codigo IS NULL OR codigo_zgen IS NULL)
          ORDER BY ABS(cantidad) DESC
        `);

      // Ejemplos aprobados
      const ejemplosAprobados = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fecha))
        .query(`
          SELECT TOP 10
            m.codigo AS codigo_interno,
            CAST(m.codigo_zgen AS INT) AS codigo_generico,
            ${tipoMov === "E" ? "m.cantidad" : "ABS(m.cantidad)"} AS cantidad,
            m.numero_lote AS lote,
            CONVERT(VARCHAR(10), m.vencimiento, 23) AS fecha_vencimiento
          FROM TBL_movimientos_cenabast m
          WHERE ${tipoMov === "E" ? "m.cantidad > 0" : "m.cantidad < 0"}
            AND CAST(m.fechaMovimiento AS DATE) = @fecha
            AND m.codigo IS NOT NULL
            AND m.codigo_zgen IS NOT NULL
          ORDER BY ABS(m.cantidad) DESC
        `);

      return NextResponse.json({
        tipo: "MOVIMIENTO",
        tipo_movimiento: tipoMov === "E" ? "ENTRADA" : "SALIDA",
        fecha,
        resumen_filtros: diagnostico.recordset,
        movimientos_rechazados: {
          total: ejemplosRechazados.recordset.length,
          ejemplos: ejemplosRechazados.recordset,
        },
        movimientos_aprobados: {
          ejemplos_top_10: ejemplosAprobados.recordset,
        },
        explicacion: {
          mensaje: "Los movimientos aprobados son los que SÍ se enviarán a CENABAST",
          filtros_aplicados: [
            "✅ fechaMovimiento debe coincidir con la fecha solicitada",
            `✅ cantidad ${tipoMov === "E" ? "> 0 (entradas)" : "< 0 (salidas)"}`,
            "❌ codigo IS NOT NULL (se pierden movimientos sin código)",
            "❌ codigo_zgen IS NOT NULL (se pierden movimientos sin código genérico)",
          ],
        },
      });
    }

    return NextResponse.json({
      error: "Tipo no válido. Usa ?tipo=stock o ?tipo=movimiento",
      ejemplos: [
        "GET /api/diagnostico-filtros?tipo=stock",
        "GET /api/diagnostico-filtros?tipo=stock&fecha=2024-12-09",
        "GET /api/diagnostico-filtros?tipo=movimiento&tipoMov=E",
        "GET /api/diagnostico-filtros?tipo=movimiento&fecha=2024-12-09&tipoMov=S",
      ],
    });
  } catch (err: any) {
    console.error("[diagnostico-filtros] Error:", err);
    return NextResponse.json(
      {
        error: {
          message: err.message,
          stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}
