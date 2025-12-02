// src/app/api/cenabast/stock/informar/route.ts
// Informar stock consolidado a CENABAST vía Mirth (v1.9)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool, sql } from "@/lib/db";
import { mirthInformarStock, type StockDetalle } from "@/lib/mirth";
import { getValidToken } from "@/lib/cenabast-token";

export const runtime = "nodejs";

// Validación del payload
const informarStockSchema = z.object({
  fecha_stock: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: YYYY-MM-DD"),
  id_relacion: z.number().int().positive(),
  // Si no se envían productos, se toman de la BD
  productos: z
    .array(
      z.object({
        codigo_interno: z.string(),
        codigo_generico: z.union([z.string(), z.number()]),
        cantidad_stock: z.number().int().min(0),
        codigo_despacho: z.union([z.string(), z.number()]).optional(),
        codigo_gtin: z.string().optional(),
        codigo_interno_despacho: z.string().optional(),
        rut_proveedor: z.string().optional(),
        descripcion_producto: z.string().optional(),
        descripcion_marca_comercial: z.string().optional(),
        pedido_compra_cenabast: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * POST /api/cenabast/stock/informar
 *
 * Envía el stock actual a CENABAST. Si no se envían productos,
 * los obtiene automáticamente de TBL_existencias_cenabast.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = informarStockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Datos inválidos", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { fecha_stock, id_relacion, productos } = parsed.data;

    // Obtener token directamente desde Mirth
    const tokenInfo = await getValidToken();
    if (!tokenInfo) {
      return NextResponse.json(
        { error: { message: "No se pudo obtener token desde Mirth" } },
        { status: 502 }
      );
    }
    const token = tokenInfo.token;

    let stockDetalle: StockDetalle[];

    if (productos && productos.length > 0) {
      stockDetalle = productos;
    } else {
      // Obtener desde BD y mapear a estructura v1.9
      const pool = await getPool();
      const result = await pool.request()
        .input("fecha", sql.Date, new Date(fecha_stock))
        .query(`
          SELECT 
            e.codigo AS codigo_interno,
            COALESCE(e.codigo_zgen, e.codigo) AS codigo_generico,
            SUM(e.existencia) AS cantidad_stock,
            MAX(e.descripcion) AS descripcion_producto
          FROM dbCenabast.dbo.TBL_existencias_cenabast e
          WHERE e.fechaCorte = @fecha
            AND e.codigo IS NOT NULL
          GROUP BY e.codigo, e.codigo_zgen
          HAVING SUM(e.existencia) > 0
        `);

      if (result.recordset.length === 0) {
        return NextResponse.json(
          { error: { message: `No hay existencias para la fecha ${fecha_stock}` } },
          { status: 404 }
        );
      }

      stockDetalle = result.recordset.map((r) => ({
        codigo_interno: r.codigo_interno,
        codigo_generico: r.codigo_generico,
        cantidad_stock: r.cantidad_stock,
        codigo_despacho: 0,
        codigo_gtin: "",
        codigo_interno_despacho: "",
        rut_proveedor: "",
        descripcion_producto: r.descripcion_producto || "",
        descripcion_marca_comercial: "",
        pedido_compra_cenabast: "",
      }));
    }

    // Llamar a Mirth para enviar a CENABAST
    const mirthResult = await mirthInformarStock(token, {
      id_relacion,
      fecha_stock,
      stock_detalle: stockDetalle,
    });

    if (!mirthResult.success) {
      const pool = await getPool();
      await pool.request()
        .input("accion", sql.VarChar(50), "INFORMAR_STOCK_ERROR")
        .input("detalle", sql.VarChar(500), mirthResult.error)
        .query(`
          INSERT INTO dbCenabast.dbo.TBL_auditoria(usuario, accion, detalle)
          VALUES ('system', @accion, @detalle)
        `);

      return NextResponse.json(
        { error: { message: mirthResult.error || "Error enviando stock a CENABAST" } },
        { status: 500 }
      );
    }

    // Auditoría OK
    const pool = await getPool();
    await pool.request()
      .input("accion", sql.VarChar(50), "INFORMAR_STOCK_OK")
      .input("detalle", sql.VarChar(500), `fecha=${fecha_stock}, productos=${stockDetalle.length}`)
      .query(`
        INSERT INTO dbCenabast.dbo.TBL_auditoria(usuario, accion, detalle)
        VALUES ('system', @accion, @detalle)
      `);

    return NextResponse.json({
      ok: true,
      fecha_stock,
      productos_enviados: stockDetalle.length,
      response: mirthResult.data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cenabast/stock/informar
 *
 * Preview: muestra qué se enviaría sin enviarlo
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get("fecha") || new Date().toISOString().slice(0, 10);

    const pool = await getPool();
    const result = await pool.request()
      .input("fecha", sql.Date, new Date(fecha))
      .query(`
        SELECT 
          e.codigo AS codigo_interno,
          COALESCE(e.codigo_zgen, e.codigo) AS codigo_generico,
          SUM(e.existencia) AS cantidad_stock,
          MAX(e.descripcion) AS descripcion_producto,
          COUNT(DISTINCT e.bodega) AS bodegas
        FROM dbCenabast.dbo.TBL_existencias_cenabast e
        WHERE e.fechaCorte = @fecha
          AND e.codigo IS NOT NULL
        GROUP BY e.codigo, e.codigo_zgen
        HAVING SUM(e.existencia) > 0
        ORDER BY e.codigo
      `);

    return NextResponse.json({
      fecha,
      total_productos: result.recordset.length,
      preview: result.recordset.slice(0, 20),
      message: "Use POST para enviar a CENABAST",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message } },
      { status: 500 }
    );
  }
}
