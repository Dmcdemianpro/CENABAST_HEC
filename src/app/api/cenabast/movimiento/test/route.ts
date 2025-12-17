/**
 * Endpoint de PRUEBA para verificar canal de Movimiento en Mirth
 *
 * Este endpoint envía datos dummy al canal de Mirth para verificar
 * que la comunicación y el procesamiento funcionan correctamente.
 *
 * USO: GET /api/cenabast/movimiento/test?tipo=E
 *
 * Parámetros:
 * - tipo: "E" (Entrada) o "S" (Salida)
 */

import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/cenabast-token";

const MIRTH_HOST = process.env.MIRTH_HOST || "10.7.71.64";
const MIRTH_PORT_MOVIMIENTO = 6664;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tipo = searchParams.get("tipo") || "E"; // E = Entrada, S = Salida

    if (tipo !== "E" && tipo !== "S") {
      return NextResponse.json(
        { error: "Parámetro 'tipo' inválido. Usar 'E' o 'S'" },
        { status: 400 }
      );
    }

    console.log("[TEST] Iniciando prueba de canal de Movimiento:", tipo === "E" ? "ENTRADA" : "SALIDA");

    // Obtener token válido
    const tokenInfo = await getValidToken();
    const token = tokenInfo?.token;

    if (!token) {
      return NextResponse.json(
        { error: "No se pudo obtener token de autenticación" },
        { status: 401 }
      );
    }

    console.log("[TEST] Token obtenido correctamente");

    // Datos dummy según tipo de movimiento
    const datosTest = tipo === "E" ? {
      // MOVIMIENTO DE ENTRADA (Factura)
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
          rut_proveedor: "76186755-5", // RUT válido (NO 11-101)
          nro_factura: "FACTURA-TEST-001",
          codigo_despacho: 0,
        },
        {
          codigo_interno: "TEST-ENTRADA-002",
          codigo_generico: 999002,
          cantidad: 50,
          lote: "LOTE-TEST-E-002",
          fecha_vencimiento: "2027-06-30",
          rut_proveedor: "76030398-4", // RUT válido
          nro_factura: "FACTURA-TEST-002",
          codigo_despacho: 0,
        },
      ],
    } : {
      // MOVIMIENTO DE SALIDA (Guía de Despacho)
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
          rut_proveedor: "77354932-K", // RUT válido (NO 11-101)
          nro_guia_despacho: "GUIA-TEST-001",
          codigo_despacho: 0,
        },
        {
          codigo_interno: "TEST-SALIDA-002",
          codigo_generico: 999004,
          cantidad: 75,
          lote: "LOTE-TEST-S-002",
          fecha_vencimiento: "2027-01-10",
          rut_proveedor: "87674400-7", // RUT válido
          nro_guia_despacho: "GUIA-TEST-002",
          codigo_despacho: 0,
        },
      ],
    };

    console.log("[TEST] Datos de prueba preparados:", JSON.stringify(datosTest, null, 2));

    // Enviar a Mirth
    const mirthUrl = `http://${MIRTH_HOST}:${MIRTH_PORT_MOVIMIENTO}/cenabast/movimiento`;
    console.log("[TEST] Enviando a Mirth:", mirthUrl);

    const mirthResponse = await fetch(mirthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(datosTest),
    });

    const mirthResponseText = await mirthResponse.text();
    console.log("[TEST] Respuesta de Mirth:", mirthResponse.status, mirthResponseText);

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
          message: "Error al enviar datos de prueba al canal",
          response: mirthData,
        },
        datos_enviados: datosTest,
        instrucciones: [
          "1. Verificar que Mirth Connect esté corriendo",
          "2. Verificar que el canal CENABAST_004_Movimiento esté activo",
          "3. Revisar logs del canal en Mirth Administrator",
          "4. Verificar que el token de autorización sea válido",
        ]
      }, { status: mirthResponse.status });
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
      },
      datos_enviados: datosTest,
      siguiente_paso: "Revisar en Mirth Administrator que el mensaje haya sido procesado correctamente",
    });

  } catch (error) {
    console.error("[TEST] Error en prueba:", error);
    return NextResponse.json({
      success: false,
      test: "CANAL DE MOVIMIENTO",
      error: error instanceof Error ? error.message : "Error desconocido",
      instrucciones: [
        "Verificar conectividad con Mirth Connect",
        "Verificar que las variables de entorno estén configuradas",
        "Revisar logs del servidor",
      ]
    }, { status: 500 });
  }
}
