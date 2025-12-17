/**
 * Endpoint de PRUEBA PÚBLICO para verificar canal de Movimiento en Mirth
 *
 * IMPORTANTE: Este endpoint NO requiere autenticación y es solo para testing
 *
 * USO: GET /api/test-mirth-movimiento?tipo=E
 */

import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/cenabast-token";

const MIRTH_HOST = process.env.MIRTH_HOST || "10.7.71.64";
const MIRTH_PORT_MOVIMIENTO = 6664;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tipo = searchParams.get("tipo") || "E";

    if (tipo !== "E" && tipo !== "S") {
      return NextResponse.json(
        { error: "Parámetro 'tipo' inválido. Usar 'E' o 'S'" },
        { status: 400 }
      );
    }

    console.log("[TEST-MIRTH] Iniciando prueba de canal de Movimiento:", tipo === "E" ? "ENTRADA" : "SALIDA");

    // Obtener token válido
    const tokenInfo = await getValidToken();
    const token = tokenInfo?.token;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: "No se pudo obtener token de autenticación de CENABAST",
        instruccion: "Ejecuta primero: POST /api/cenabast/auth para obtener un token",
      }, { status: 401 });
    }

    console.log("[TEST-MIRTH] Token obtenido correctamente");

    // Datos dummy según tipo de movimiento
    const datosTest = tipo === "E" ? {
      id_relacion: 286,
      fecha_movimiento: new Date().toISOString().split("T")[0],
      tipo_movimiento: "E",
      tipo_compra: "C",
      movimiento_detalle: [
        {
          codigo_interno: "TEST-ENTRADA-001",
          codigo_generico: 999001,
          cantidad: 100,
          lote: "LOTE-TEST-E-001",
          fecha_vencimiento: "2026-12-31",
          rut_proveedor: "76186755-5",
          nro_factura: "FACTURA-TEST-001",
          codigo_despacho: 0,
        },
        {
          codigo_interno: "TEST-ENTRADA-002",
          codigo_generico: 999002,
          cantidad: 50,
          lote: "LOTE-TEST-E-002",
          fecha_vencimiento: "2027-06-30",
          rut_proveedor: "76030398-4",
          nro_factura: "FACTURA-TEST-002",
          codigo_despacho: 0,
        },
      ],
    } : {
      id_relacion: 286,
      fecha_movimiento: new Date().toISOString().split("T")[0],
      tipo_movimiento: "S",
      tipo_compra: "C",
      movimiento_detalle: [
        {
          codigo_interno: "TEST-SALIDA-001",
          codigo_generico: 999003,
          cantidad: 30,
          lote: "LOTE-TEST-S-001",
          fecha_vencimiento: "2026-09-20",
          rut_proveedor: "77354932-K",
          nro_guia_despacho: "GUIA-TEST-001",
          codigo_despacho: 0,
        },
        {
          codigo_interno: "TEST-SALIDA-002",
          codigo_generico: 999004,
          cantidad: 75,
          lote: "LOTE-TEST-S-002",
          fecha_vencimiento: "2027-01-10",
          rut_proveedor: "87674400-7",
          nro_guia_despacho: "GUIA-TEST-002",
          codigo_despacho: 0,
        },
      ],
    };

    console.log("[TEST-MIRTH] Datos preparados:", JSON.stringify(datosTest, null, 2));

    // Enviar a Mirth
    const mirthUrl = `http://${MIRTH_HOST}:${MIRTH_PORT_MOVIMIENTO}/cenabast/movimiento`;
    console.log("[TEST-MIRTH] Enviando a Mirth:", mirthUrl);
    console.log("[TEST-MIRTH] Con token:", token ? "Token disponible ✓" : "Sin token ✗");

    const mirthResponse = await fetch(mirthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(datosTest),
    });

    const mirthResponseText = await mirthResponse.text();
    console.log("[TEST-MIRTH] Respuesta de Mirth:", mirthResponse.status, mirthResponseText);

    let mirthData: any;
    try {
      mirthData = JSON.parse(mirthResponseText);
    } catch {
      mirthData = { message: mirthResponseText };
    }

    // Analizar respuesta
    if (!mirthResponse.ok) {
      return NextResponse.json({
        success: false,
        test: "CANAL DE MOVIMIENTO",
        tipo: tipo === "E" ? "Entrada" : "Salida",
        error: {
          status: mirthResponse.status,
          message: "Error al enviar datos de prueba al canal de Mirth",
          response: mirthData,
        },
        datos_enviados: datosTest,
        token_usado: token ? "SI (token presente)" : "NO",
        url_mirth: mirthUrl,
        instrucciones: [
          "1. Verificar que Mirth Connect esté corriendo en 10.7.71.64",
          "2. Verificar que el canal CENABAST_004_Movimiento esté activo",
          "3. Revisar logs del canal en Mirth Administrator",
          "4. Verificar que el token de autorización sea válido",
        ]
      }, { status: 200 }); // Devolvemos 200 para que el navegador muestre el JSON
    }

    // Verificar si el payload indica error
    if (mirthData?.statusCode && !mirthData?.isSuccessful) {
      return NextResponse.json({
        success: false,
        test: "CANAL DE MOVIMIENTO",
        tipo: tipo === "E" ? "Entrada" : "Salida",
        warning: "El canal respondió 200 pero indica error interno",
        error: mirthData,
        datos_enviados: datosTest,
      }, { status: 200 });
    }

    // Éxito
    return NextResponse.json({
      success: true,
      test: "CANAL DE MOVIMIENTO",
      tipo: tipo === "E" ? "Entrada" : "Salida",
      message: "✅ Canal de Movimiento funcionando correctamente",
      detalles: {
        items_enviados: datosTest.movimiento_detalle.length,
        fecha_movimiento: datosTest.fecha_movimiento,
        ruts_validos: datosTest.movimiento_detalle.map((d: any) => d.rut_proveedor),
        mirth_status: mirthResponse.status,
        mirth_response: mirthData,
        token_enviado: "SI",
      },
      datos_enviados: datosTest,
      siguiente_paso: "Revisar en Mirth Administrator (canal CENABAST_004_Movimiento) que el mensaje haya sido procesado como TRANSFORMED",
    }, { status: 200 });

  } catch (error) {
    console.error("[TEST-MIRTH] Error en prueba:", error);
    return NextResponse.json({
      success: false,
      test: "CANAL DE MOVIMIENTO",
      error: error instanceof Error ? error.message : "Error desconocido",
      stack: error instanceof Error ? error.stack : undefined,
      instrucciones: [
        "Verificar conectividad con Mirth Connect (10.7.71.64:6664)",
        "Verificar que las variables de entorno estén configuradas",
        "Revisar logs del servidor Next.js en la terminal",
      ]
    }, { status: 200 }); // Devolvemos 200 para que el navegador muestre el JSON
  }
}
