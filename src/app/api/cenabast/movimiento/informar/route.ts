// src/app/api/cenabast/movimiento/informar/route.ts
// Informar movimientos a CENABAST vía Mirth

import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool, sql } from "@/lib/db";
import { mirthInformarMovimiento, type MovimientoDetalle } from "@/lib/mirth";

export const runtime = "nodejs";

// Validación del payload
const informarMovimientoSchema = z.object({
  fecha_movimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: YYYY-MM-DD"),
  id_relacion: z.number().int().positive(),
  tipo_movimiento: z.enum(["E", "S"]), // Entrada o Salida
  tipo_compra: z.enum(["C", "M"]), // CENABAST o Mercado Público
  // Si no se envían detalles, se toman de la BD
  detalles: z
    .array(
      z.object({
        codigo_interno: z.string(),
        codigo_generico: z.string(),
        cantidad: z.number().int().positive(),
        lote: z.string().optional(),
        fecha_vencimiento: z.string().optional(),
        rut_proveedor: z.string().optional(),
        nro_factura: z.string().optional(),
        nro_guia_despacho: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * Obtiene el token CENABAST almacenado
 */
async function getCenabastToken(): Promise<string | null> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT token, expires_at 
    FROM dbCenabast.dbo.TBL_cenabast_token 
    WHERE id = 1
  `);

  const row = result.recordset[0];
  if (!row?.token) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  return row.token;
}

/**
 * Mapea tipo de documento local a tipo_movimiento CENABAST
 */
function mapTipoDocumento(tipoDoc: string): "E" | "S" {
  const entradas = ["GUIA RECEPCION", "NOTA CREDITO", "INGRESO", "RECEPCION", "GR"];
  const salidas = ["GUIA DESPACHO", "SALIDA", "CONSUMO", "GD", "RECETA"];
  
  const upper = tipoDoc?.toUpperCase() || "";
  
  if (entradas.some(e => upper.includes(e))) return "E";
  if (salidas.some(s => upper.includes(s))) return "S";
  
  // Por defecto, si cantidad > 0 es entrada, si < 0 es salida
  return "E";
}

/**
 * POST /api/cenabast/movimiento/informar
 * 
 * Envía movimientos a CENABAST
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = informarMovimientoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Datos inválidos", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { fecha_movimiento, id_relacion, tipo_movimiento, tipo_compra, detalles } = parsed.data;

    // Obtener token
    const token = await getCenabastToken();
    if (!token) {
      return NextResponse.json(
        { error: { message: "Token CENABAST no disponible o expirado" } },
        { status: 401 }
      );
    }

    let movimientoDetalle: MovimientoDetalle[];

    if (detalles && detalles.length > 0) {
      movimientoDetalle = detalles;
    } else {
      // Obtener de la base de datos
      const pool = await getPool();
      const result = await pool.request()
        .input("fecha", sql.Date, new Date(fecha_movimiento))
        .input("tipoMov", sql.Char(1), tipo_movimiento)
        .query(`
          SELECT 
            m.codigo AS codigo_interno,
            COALESCE(m.codigo_zgen, m.codigo) AS codigo_generico,
            ABS(m.cantidad) AS cantidad,
            m.numero_lote AS lote,
            m.vencimiento AS fecha_vencimiento,
            m.rut AS rut_proveedor,
            m.numero AS nro_factura
          FROM dbCenabast.dbo.TBL_movimientos_cenabast m
          WHERE m.fechaMovimiento = @fecha
            AND m.codigo IS NOT NULL
            AND (
              (@tipoMov = 'E' AND m.cantidad > 0) OR
              (@tipoMov = 'S' AND m.cantidad < 0)
            )
        `);

      if (result.recordset.length === 0) {
        return NextResponse.json(
          { error: { message: `No hay movimientos tipo ${tipo_movimiento} para ${fecha_movimiento}` } },
          { status: 404 }
        );
      }

      movimientoDetalle = result.recordset.map((r) => ({
        codigo_interno: r.codigo_interno,
        codigo_generico: r.codigo_generico,
        cantidad: r.cantidad,
        lote: r.lote || undefined,
        fecha_vencimiento: r.fecha_vencimiento 
          ? new Date(r.fecha_vencimiento).toISOString().slice(0, 10) 
          : undefined,
        rut_proveedor: r.rut_proveedor || undefined,
        nro_factura: r.nro_factura || undefined,
      }));
    }

    // Llamar a Mirth
    const mirthResult = await mirthInformarMovimiento(token, {
      id_relacion,
      fecha_movimiento,
      tipo_movimiento,
      tipo_compra,
      movimiento_detalle: movimientoDetalle,
    });

    if (!mirthResult.success) {
      // Registrar error
      const pool = await getPool();
      await pool.request()
        .input("accion", sql.VarChar(50), "INFORMAR_MOVIMIENTO_ERROR")
        .input("detalle", sql.VarChar(500), mirthResult.error)
        .query(`
          INSERT INTO dbCenabast.dbo.TBL_auditoria(usuario, accion, detalle)
          VALUES ('system', @accion, @detalle)
        `);

      return NextResponse.json(
        { error: { message: mirthResult.error } },
        { status: 500 }
      );
    }

    // Registrar éxito
    const pool = await getPool();
    await pool.request()
      .input("accion", sql.VarChar(50), "INFORMAR_MOVIMIENTO_OK")
      .input("detalle", sql.VarChar(500), 
        `fecha=${fecha_movimiento}, tipo=${tipo_movimiento}, items=${movimientoDetalle.length}`)
      .query(`
        INSERT INTO dbCenabast.dbo.TBL_auditoria(usuario, accion, detalle)
        VALUES ('system', @accion, @detalle)
      `);

    return NextResponse.json({
      ok: true,
      fecha_movimiento,
      tipo_movimiento,
      tipo_compra,
      items_enviados: movimientoDetalle.length,
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
 * GET /api/cenabast/movimiento/informar
 * 
 * Preview de movimientos por fecha y tipo
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get("fecha") || new Date().toISOString().slice(0, 10);
    const tipo = (searchParams.get("tipo") || "E").toUpperCase() as "E" | "S";

    const pool = await getPool();
    const result = await pool.request()
      .input("fecha", sql.Date, new Date(fecha))
      .input("tipoMov", sql.Char(1), tipo)
      .query(`
        SELECT 
          m.codigo AS codigo_interno,
          COALESCE(m.codigo_zgen, m.codigo) AS codigo_generico,
          m.descripcion,
          ABS(m.cantidad) AS cantidad,
          m.numero_lote AS lote,
          m.vencimiento,
          m.tipoDocumento,
          COUNT(1) AS registros
        FROM dbCenabast.dbo.TBL_movimientos_cenabast m
        WHERE m.fechaMovimiento = @fecha
          AND m.codigo IS NOT NULL
          AND (
            (@tipoMov = 'E' AND m.cantidad > 0) OR
            (@tipoMov = 'S' AND m.cantidad < 0)
          )
        GROUP BY m.codigo, m.codigo_zgen, m.descripcion, m.cantidad, 
                 m.numero_lote, m.vencimiento, m.tipoDocumento
        ORDER BY m.codigo
      `);

    return NextResponse.json({
      fecha,
      tipo_movimiento: tipo,
      tipo_descripcion: tipo === "E" ? "Entradas" : "Salidas",
      total_items: result.recordset.length,
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
