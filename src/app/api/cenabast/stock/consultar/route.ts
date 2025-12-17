// src/app/api/cenabast/stock/consultar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/cenabast-token";
import { mirthConsultarStock } from "@/lib/mirth";
import { parseMirthError, formatMirthErrorForLog } from "@/lib/mirth-error-handler";

export const runtime = "nodejs";

/**
 * GET /api/cenabast/stock/consultar?mes=12&anio=2024
 * Consulta el stock informado a CENABAST para un mes/año específico
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mes = searchParams.get("mes");
    const anio = searchParams.get("anio");

    // Validar parámetros
    if (!mes || !anio) {
      return NextResponse.json({
        success: false,
        error: {
          message: "Faltan parámetros requeridos",
          detalles: ["Se requieren los parámetros: mes (1-12) y anio (YYYY)"],
        }
      }, { status: 400 });
    }

    const mesNum = parseInt(mes);
    const anioNum = parseInt(anio);

    if (isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return NextResponse.json({
        success: false,
        error: {
          message: "Mes inválido",
          detalles: ["El mes debe ser un número entre 1 y 12"],
        }
      }, { status: 400 });
    }

    if (isNaN(anioNum) || anioNum < 2020 || anioNum > 2100) {
      return NextResponse.json({
        success: false,
        error: {
          message: "Año inválido",
          detalles: ["El año debe ser un número entre 2020 y 2100"],
        }
      }, { status: 400 });
    }

    // Obtener solicitante desde env
    const solicitante =
      process.env.NEXT_PUBLIC_CENABAST_RUT ||
      process.env.CENABAST_RUT_SOLICITANTE ||
      "61980320";

    console.log("[stock/consultar] Consultando stock para:", { solicitante, mes: mesNum, anio: anioNum });

    // Obtener token
    const tokenInfo = await getValidToken();
    const token = tokenInfo?.token;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: {
          message: "No se pudo obtener token de autenticación",
        }
      }, { status: 401 });
    }

    // Consultar stock en CENABAST vía Mirth
    const result = await mirthConsultarStock(token, {
      solicitante,
      mes: mesNum,
      anio: anioNum,
    });

    console.log("[stock/consultar] Respuesta de Mirth:", result);

    // Manejar errores
    if (!result.success) {
      const parsedError = parseMirthError(result.data || result);
      console.error("[stock/consultar] Error parseado:", formatMirthErrorForLog(parsedError));

      return NextResponse.json({
        success: false,
        error: {
          tipo: parsedError.tipo,
          message: parsedError.mensaje,
          detalles: parsedError.detalles,
          sugerencias: parsedError.sugerencias,
        }
      }, { status: result.statusCode || 500 });
    }

    // Verificar si el payload indica error
    if (result.data?.statusCode && !result.data?.isSuccessful) {
      const parsedError = parseMirthError(result.data);
      console.error("[stock/consultar] Error en respuesta:", formatMirthErrorForLog(parsedError));

      return NextResponse.json({
        success: false,
        error: {
          tipo: parsedError.tipo,
          message: parsedError.mensaje,
          detalles: parsedError.detalles,
          sugerencias: parsedError.sugerencias,
        },
        response: result.data,
      }, { status: result.data.statusCode || 500 });
    }

    // Respuesta exitosa
    return NextResponse.json({
      success: true,
      data: result.data,
      consulta: {
        solicitante,
        mes: mesNum,
        anio: anioNum,
        periodo: `${mesNum.toString().padStart(2, '0')}/${anioNum}`,
      }
    });

  } catch (error) {
    console.error("[stock/consultar] Error:", error);
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Error desconocido",
      }
    }, { status: 500 });
  }
}
