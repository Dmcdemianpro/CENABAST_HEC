// src/app/api/cenabast/stock/reglas/route.ts
// Gestión de reglas min/max de stock con CENABAST

import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool, sql } from "@/lib/db";
import { mirthSetReglasStock, mirthGetReglasStock } from "@/lib/mirth";
import { getValidToken } from "@/lib/cenabast-token";

export const runtime = "nodejs";

const reglaSchema = z.object({
  RutSolicitante: z.string().min(1),
  IdRelacion: z.number().int().positive(),
  CodigoProducto: z.string().min(1),
  StockMinimo: z.number().int().min(0),
  StockMaximo: z.number().int().min(0),
});

const setReglasSchema = z.object({
  reglas: z.array(reglaSchema).min(1),
});

const getReglaSchema = z.object({
  solicitante: z.string().min(1),
  idRelacion: z.coerce.number().int().positive(),
  codigoProducto: z.string().min(1),
});

/**
 * POST /api/cenabast/stock/reglas
 * 
 * Envía reglas de stock min/max a CENABAST
 * También actualiza la tabla local TBL_existencias_cenabast
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = setReglasSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Datos inválidos", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { reglas } = parsed.data;

    // Validar que min <= max
    for (const r of reglas) {
      if (r.StockMinimo > r.StockMaximo) {
        return NextResponse.json(
          { error: { message: `StockMinimo > StockMaximo para producto ${r.CodigoProducto}` } },
          { status: 400 }
        );
      }
    }

    // Obtener token
    const tokenInfo = await getValidToken();
    if (!tokenInfo) {
      return NextResponse.json(
        { error: { message: "No se pudo obtener token desde Mirth" } },
        { status: 502 }
      );
    }
    const token = tokenInfo.token;

    // Enviar a CENABAST vía Mirth
    const mirthResult = await mirthSetReglasStock(token, reglas);

    if (!mirthResult.success) {
      return NextResponse.json(
        { error: { message: mirthResult.error } },
        { status: 500 }
      );
    }

    // Actualizar tabla local
    const pool = await getPool();
    
    for (const regla of reglas) {
      await pool.request()
        .input("codigo", sql.VarChar(50), regla.CodigoProducto)
        .input("stockMin", sql.Float, regla.StockMinimo)
        .input("stockMax", sql.Float, regla.StockMaximo)
        .query(`
          UPDATE dbCenabast.dbo.TBL_existencias_cenabast
          SET 
            stock_minimo = @stockMin,
            stock_maximo = @stockMax,
            fechaCarga = GETDATE()
          WHERE codigo = @codigo OR codigo_zgen = @codigo
        `);
    }

    // Auditoría
    await pool.request()
      .input("accion", sql.VarChar(50), "SET_REGLAS_STOCK")
      .input("detalle", sql.VarChar(500), `reglas=${reglas.length}`)
      .query(`
        INSERT INTO dbCenabast.dbo.TBL_auditoria(usuario, accion, detalle)
        VALUES ('system', @accion, @detalle)
      `);

    return NextResponse.json({
      ok: true,
      reglas_enviadas: reglas.length,
      actualizadas_local: true,
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
 * GET /api/cenabast/stock/reglas
 * 
 * Consulta reglas de un producto específico en CENABAST
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    const parsed = getReglaSchema.safeParse({
      solicitante: searchParams.get("solicitante"),
      idRelacion: searchParams.get("idRelacion"),
      codigoProducto: searchParams.get("codigoProducto"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: { 
            message: "Parámetros requeridos: solicitante, idRelacion, codigoProducto",
            details: parsed.error.flatten() 
          } 
        },
        { status: 400 }
      );
    }

    const { solicitante, idRelacion, codigoProducto } = parsed.data;

    const tokenInfo = await getValidToken();
    if (!tokenInfo) {
      return NextResponse.json(
        { error: { message: "No se pudo obtener token desde Mirth" } },
        { status: 502 }
      );
    }
    const token = tokenInfo.token;

    // Consultar en CENABAST
    const mirthResult = await mirthGetReglasStock(token, {
      solicitante,
      idRelacion,
      codigoProducto,
    });

    if (!mirthResult.success) {
      return NextResponse.json(
        { error: { message: mirthResult.error } },
        { status: 500 }
      );
    }

    // También obtener datos locales para comparar
    const pool = await getPool();
    const localResult = await pool.request()
      .input("codigo", sql.VarChar(50), codigoProducto)
      .query(`
        SELECT 
          codigo, codigo_zgen, descripcion,
          stock_minimo, stock_critico, stock_maximo,
          existencia
        FROM dbCenabast.dbo.TBL_existencias_cenabast
        WHERE codigo = @codigo OR codigo_zgen = @codigo
      `);

    return NextResponse.json({
      cenabast: mirthResult.data,
      local: localResult.recordset[0] || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cenabast/stock/reglas
 * 
 * Sincroniza reglas desde existencias locales a CENABAST
 */
export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rutSolicitante = searchParams.get("rutSolicitante") || process.env.CENABAST_RUT_SOLICITANTE;
    const idRelacion = Number(searchParams.get("idRelacion") || process.env.CENABAST_ID_RELACION || "1");

    if (!rutSolicitante) {
      return NextResponse.json(
        { error: { message: "rutSolicitante es requerido" } },
        { status: 400 }
      );
    }

    const tokenInfo = await getValidToken();
    if (!tokenInfo) {
      return NextResponse.json(
        { error: { message: "No se pudo obtener token desde Mirth" } },
        { status: 502 }
      );
    }
    const token = tokenInfo.token;

    // Obtener productos con stock min/max definido
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT
        e.codigo AS CodigoProducto,
        e.stock_minimo AS StockMinimo,
        e.stock_maximo AS StockMaximo
      FROM dbCenabast.dbo.TBL_existencias_cenabast e
      WHERE e.stock_minimo IS NOT NULL 
        AND e.stock_maximo IS NOT NULL
        AND e.stock_minimo > 0
        AND e.stock_maximo > 0
        AND e.codigo IS NOT NULL
    `);

    if (result.recordset.length === 0) {
      return NextResponse.json({
        ok: false,
        message: "No hay productos con reglas de stock definidas",
      });
    }

    const reglas = result.recordset.map((r) => ({
      RutSolicitante: rutSolicitante,
      IdRelacion: idRelacion,
      CodigoProducto: r.CodigoProducto,
      StockMinimo: Math.round(r.StockMinimo),
      StockMaximo: Math.round(r.StockMaximo),
    }));

    // Enviar a CENABAST
    const mirthResult = await mirthSetReglasStock(token, reglas);

    if (!mirthResult.success) {
      return NextResponse.json(
        { error: { message: mirthResult.error } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sincronizadas: reglas.length,
      response: mirthResult.data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message } },
      { status: 500 }
    );
  }
}
