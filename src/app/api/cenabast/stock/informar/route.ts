// src/app/api/cenabast/stock/informar/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidDateFormat, toSqlDate, getDateDiagnostic } from "@/lib/date-validator";
import { parseMirthError, formatMirthErrorForUser, formatMirthErrorForLog } from "@/lib/mirth-error-handler";

export const runtime = "nodejs";

let getPool: any, sql: any, mirthInformarStock: any, getValidToken: any;

try {
  const dbModule = require("@/lib/db");
  getPool = dbModule.getPool;
  sql = dbModule.sql;
} catch (e) {
  console.error("[stock/informar] Error importando @/lib/db:", e);
}

try {
  const mirthModule = require("@/lib/mirth");
  mirthInformarStock = mirthModule.mirthInformarStock;
} catch (e) {
  console.error("[stock/informar] Error importando @/lib/mirth:", e);
}

try {
  const tokenModule = require("@/lib/cenabast-token");
  getValidToken = tokenModule.getValidToken;
} catch (e) {
  console.error("[stock/informar] Error importando @/lib/cenabast-token:", e);
}

const informarStockSchema = z.object({
  fecha_stock: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: YYYY-MM-DD").optional(),
  id_relacion: z.number().int().positive(),
  productos: z.array(z.object({
    codigo_interno: z.string(),
    codigo_generico: z.union([z.string(), z.number()]),
    cantidad_stock: z.number().int().min(0),
    codigo_despacho: z.union([z.string(), z.number()]).optional(),
    descripcion_producto: z.string().optional(),
  })).optional(),
});

function parseDateOnly(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function POST(req: Request) {
  console.log("[stock/informar] POST - Iniciando");
  
  if (!getPool || !sql) {
    return NextResponse.json(
      { success: false, error: { message: "Módulo db no disponible" } },
      { status: 500 }
    );
  }
  
  if (!mirthInformarStock) {
    return NextResponse.json(
      { success: false, error: { message: "Módulo mirth no disponible" } },
      { status: 500 }
    );
  }
  
  if (!getValidToken) {
    return NextResponse.json(
      { success: false, error: { message: "Módulo token no disponible" } },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    console.log("[stock/informar] Body recibido:", JSON.stringify(body, null, 2));
    
    const parsed = informarStockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Datos inválidos", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    let { fecha_stock, id_relacion, productos } = parsed.data;

    // Obtener token
    console.log("[stock/informar] Obteniendo token...");
    const tokenResult = await getValidToken();
    
    let token: string;
    if (typeof tokenResult === 'string') {
      token = tokenResult;
    } else if (tokenResult && typeof tokenResult === 'object' && tokenResult.token) {
      token = tokenResult.token;
    } else {
      return NextResponse.json(
        { success: false, error: { message: "No se pudo obtener token" } },
        { status: 502 }
      );
    }
    
    console.log("[stock/informar] Token obtenido (length):", token.length);

    let stockDetalle: any[];
    let fechaUsada: string;

    if (productos && productos.length > 0) {
      console.log("[stock/informar] Usando productos del request:", productos.length);
      fechaUsada = fecha_stock || new Date().toISOString().split('T')[0];
      stockDetalle = productos.map((p) => ({
        codigo_interno: String(p.codigo_interno),
        codigo_generico: Number(p.codigo_generico) || 0,
        cantidad_stock: Number(p.cantidad_stock) || 0,
        codigo_despacho: p.codigo_despacho != null ? Number(p.codigo_despacho) : 0,
        descripcion_producto: p.descripcion_producto || "",
      }));
    } else {
      // Obtener desde BD
      const pool = await getPool();
      
      // Si se especificó fecha, verificar si tiene datos
      if (fecha_stock) {
        console.log("[stock/informar] Verificando datos para fecha:", fecha_stock);
        const fechaCheck = await pool.request()
          .input("fecha", sql.Date, parseDateOnly(fecha_stock))
          .query(`
            SELECT COUNT(*) AS total 
            FROM TBL_existencias_cenabast 
            WHERE fechaCorte = @fecha AND existencia > 0
          `);
        
        if (fechaCheck.recordset[0].total > 0) {
          fechaUsada = fecha_stock;
          console.log("[stock/informar] Fecha válida con", fechaCheck.recordset[0].total, "registros");
        } else {
          console.log("[stock/informar] No hay datos para", fecha_stock);
          fecha_stock = undefined; // Forzar usar última fecha
        }
      }
      
      // Si no hay fecha o no tiene datos, usar la última disponible
      if (!fecha_stock) {
        console.log("[stock/informar] Buscando última fecha con datos...");
        const ultimaFecha = await pool.request().query(`
          SELECT TOP 1 
            CONVERT(VARCHAR(10), fechaCorte, 23) AS fechaCorte,
            COUNT(*) AS registros
          FROM TBL_existencias_cenabast 
          WHERE existencia > 0
          GROUP BY fechaCorte
          ORDER BY fechaCorte DESC
        `);
        
        if (ultimaFecha.recordset.length === 0) {
          return NextResponse.json({
            success: false,
            error: { message: "No hay existencias en la base de datos" },
            sugerencia: "Verifique que TBL_existencias_cenabast tenga datos con existencia > 0"
          }, { status: 404 });
        }
        
        fechaUsada = ultimaFecha.recordset[0].fechaCorte;
        console.log("[stock/informar] Usando última fecha:", fechaUsada, "con", ultimaFecha.recordset[0].registros, "registros");
      } else {
        fechaUsada = fecha_stock;
      }
      
      // Obtener productos - SIN FILTROS según guía CENABAST v1.9
      // Se envía TODO, incluso con codigo_zgen NULL o no numérico
      // Usar ISNULL para valores por defecto en lugar de filtrar
      const result = await pool.request()
        .input("fecha", sql.Date, parseDateOnly(fechaUsada))
        .query(`
          SELECT
            ISNULL(e.codigo, '') AS codigo_interno,
            ISNULL(TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT), 0) AS codigo_generico,
            SUM(e.existencia) AS cantidad_stock,
            MAX(e.descripcion) AS descripcion_producto
          FROM TBL_existencias_cenabast e
          WHERE e.fechaCorte = @fecha
            AND e.existencia > 0
          GROUP BY e.codigo, e.codigo_zgen
        `);

      console.log("[stock/informar] Productos encontrados:", result.recordset.length);

      if (result.recordset.length === 0) {
        // Mostrar info de diagnóstico
        const diagnostico = await pool.request().query(`
          SELECT 
            COUNT(*) AS total_registros,
            COUNT(DISTINCT fechaCorte) AS fechas_distintas,
            MIN(fechaCorte) AS fecha_min,
            MAX(fechaCorte) AS fecha_max,
            SUM(CASE WHEN existencia > 0 THEN 1 ELSE 0 END) AS con_stock
          FROM TBL_existencias_cenabast
        `);
        
        return NextResponse.json({
          success: false,
          error: { message: "No hay productos con stock > 0" },
          diagnostico: diagnostico.recordset[0]
        }, { status: 404 });
      }

      stockDetalle = result.recordset.map((r: any) => ({
        codigo_interno: String(r.codigo_interno),
        codigo_generico: Number(r.codigo_generico) || 0,
        cantidad_stock: Number(r.cantidad_stock) || 0,
        codigo_despacho: 0,
        descripcion_producto: r.descripcion_producto || "",
      }));
    }

    // Validar fecha antes de enviar
    if (!isValidDateFormat(fechaUsada)) {
      const diagnostic = getDateDiagnostic(fechaUsada);
      console.error("[stock/informar] Fecha inválida:", diagnostic);

      return NextResponse.json({
        success: false,
        error: {
          message: "Fecha de stock inválida",
          details: diagnostic,
        }
      }, { status: 400 });
    }

    // Sanitizar fecha para asegurar formato correcto
    const fechaSanitizada = toSqlDate(fechaUsada);
    if (!fechaSanitizada) {
      return NextResponse.json({
        success: false,
        error: {
          message: "No se pudo convertir la fecha a formato SQL válido",
          fecha_original: fechaUsada,
        }
      }, { status: 400 });
    }

    // Enviar a Mirth
    console.log("[stock/informar] Enviando", stockDetalle.length, "productos a Mirth...");
    console.log("[stock/informar] Fecha sanitizada:", fechaSanitizada);

    const mirthResult = await mirthInformarStock(token, {
      id_relacion,
      fecha_stock: fechaSanitizada,
      stock_detalle: stockDetalle,
    });

    console.log("[stock/informar] Respuesta de Mirth:", mirthResult);

    // Manejar errores de Mirth con parser especializado
    if (!mirthResult.success) {
      const parsedError = parseMirthError(mirthResult.data || mirthResult);
      console.error("[stock/informar] Error parseado:", formatMirthErrorForLog(parsedError));

      return NextResponse.json({
        success: false,
        error: {
          tipo: parsedError.tipo,
          message: parsedError.mensaje,
          detalles: parsedError.detalles,
          sugerencias: parsedError.sugerencias,
          esRecuperable: parsedError.esRecuperable,
        }
      }, { status: mirthResult.statusCode || 500 });
    }

    // Si Mirth responde con success pero el payload indica error
    if (mirthResult.data?.statusCode && !mirthResult.data?.isSuccessful) {
      const parsedError = parseMirthError(mirthResult.data);
      console.error("[stock/informar] Error en respuesta exitosa:", formatMirthErrorForLog(parsedError));

      return NextResponse.json({
        success: false,
        error: {
          tipo: parsedError.tipo,
          message: parsedError.mensaje,
          detalles: parsedError.detalles,
          sugerencias: parsedError.sugerencias,
          esRecuperable: parsedError.esRecuperable,
        },
        response: mirthResult.data,
      }, { status: mirthResult.data.statusCode || 500 });
    }

    return NextResponse.json({
      success: true,
      ok: true,
      fecha_stock: fechaUsada,
      productos_enviados: stockDetalle.length,
      response: mirthResult.data || mirthResult,
    });
    
  } catch (err: any) {
    console.error("[stock/informar] Error:", err);
    return NextResponse.json(
      { success: false, error: { message: err.message } },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  console.log("[stock/informar] GET - Preview/Diagnóstico");
  
  if (!getPool || !sql) {
    return NextResponse.json(
      { success: false, error: { message: "Módulo db no disponible" } },
      { status: 500 }
    );
  }

  try {
    const pool = await getPool();
    
    // Diagnóstico de la tabla
    const diagnostico = await pool.request().query(`
      SELECT 
        COUNT(*) AS total_registros,
        COUNT(DISTINCT fechaCorte) AS fechas_distintas,
        CONVERT(VARCHAR(10), MIN(fechaCorte), 23) AS fecha_min,
        CONVERT(VARCHAR(10), MAX(fechaCorte), 23) AS fecha_max,
        SUM(CASE WHEN existencia > 0 THEN 1 ELSE 0 END) AS registros_con_stock,
        SUM(existencia) AS stock_total
      FROM TBL_existencias_cenabast
    `);
    
    // Últimas 5 fechas con datos
    const fechas = await pool.request().query(`
      SELECT TOP 5
        CONVERT(VARCHAR(10), fechaCorte, 23) AS fecha,
        COUNT(*) AS productos,
        SUM(existencia) AS stock_total
      FROM TBL_existencias_cenabast
      WHERE existencia > 0
      GROUP BY fechaCorte
      ORDER BY fechaCorte DESC
    `);

    return NextResponse.json({
      success: true,
      tabla: "TBL_existencias_cenabast",
      diagnostico: diagnostico.recordset[0],
      ultimas_fechas: fechas.recordset,
      uso: {
        POST: {
          url: "/api/cenabast/stock/informar",
          body: {
            id_relacion: 1,
            fecha_stock: "YYYY-MM-DD (opcional, usa última fecha si no se envía)"
          }
        }
      }
    });
  } catch (err: any) {
    console.error("[stock/informar] GET Error:", err);
    return NextResponse.json(
      { success: false, error: { message: err.message } },
      { status: 500 }
    );
  }
}
