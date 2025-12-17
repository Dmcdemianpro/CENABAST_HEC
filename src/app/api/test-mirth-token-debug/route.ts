/**
 * Endpoint DEBUG: Prueba múltiples formas de enviar el token a Mirth
 * Para identificar cómo el transformer espera recibir el token
 */

import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/cenabast-token";

const MIRTH_HOST = process.env.MIRTH_HOST || "10.7.71.64";
const MIRTH_PORT_MOVIMIENTO = 6664;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const metodo = searchParams.get("metodo") || "header";

    console.log("[TOKEN-DEBUG] Método de envío:", metodo);

    // Obtener token
    const tokenInfo = await getValidToken();
    const token = tokenInfo?.token;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: "No hay token disponible en la BD",
      }, { status: 200 });
    }

    console.log("[TOKEN-DEBUG] Token obtenido:", token.substring(0, 20) + "...");

    // Datos de prueba mínimos
    const datosTest = {
      id_relacion: 286,
      fecha_movimiento: new Date().toISOString().split("T")[0],
      tipo_movimiento: "E",
      tipo_compra: "C",
      movimiento_detalle: [
        {
          codigo_interno: "DEBUG-001",
          codigo_generico: 999999,
          cantidad: 1,
          rut_proveedor: "76186755-5",
          nro_factura: "DEBUG-001",
          codigo_despacho: 0,
        }
      ],
    };

    const mirthUrl = `http://${MIRTH_HOST}:${MIRTH_PORT_MOVIMIENTO}/cenabast/movimiento`;

    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    let url = mirthUrl;
    let body = datosTest;

    // Probar diferentes métodos de envío del token
    switch (metodo) {
      case "header":
        // Método 1: Header Authorization (estándar)
        headers["Authorization"] = `Bearer ${token}`;
        console.log("[TOKEN-DEBUG] Enviando token en header Authorization");
        break;

      case "header-token":
        // Método 2: Header custom "token"
        headers["token"] = token;
        console.log("[TOKEN-DEBUG] Enviando token en header 'token'");
        break;

      case "query":
        // Método 3: Query string
        url = `${mirthUrl}?token=${encodeURIComponent(token)}`;
        console.log("[TOKEN-DEBUG] Enviando token en query string");
        break;

      case "body":
        // Método 4: En el body del mensaje
        body = { ...datosTest, token };
        console.log("[TOKEN-DEBUG] Enviando token en el body");
        break;

      case "body-auth":
        // Método 5: En el body como 'authorization'
        body = { ...datosTest, authorization: token };
        console.log("[TOKEN-DEBUG] Enviando token en el body como 'authorization'");
        break;

      case "all":
        // Método 6: Enviar en TODOS lados
        headers["Authorization"] = `Bearer ${token}`;
        headers["token"] = token;
        url = `${mirthUrl}?token=${encodeURIComponent(token)}`;
        body = { ...datosTest, token, authorization: token };
        console.log("[TOKEN-DEBUG] Enviando token en TODOS los lugares posibles");
        break;

      default:
        headers["Authorization"] = `Bearer ${token}`;
    }

    console.log("[TOKEN-DEBUG] URL:", url);
    console.log("[TOKEN-DEBUG] Headers:", JSON.stringify(headers, null, 2));

    const mirthResponse = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const mirthResponseText = await mirthResponse.text();
    console.log("[TOKEN-DEBUG] Respuesta Mirth:", mirthResponse.status, mirthResponseText);

    let mirthData: any;
    try {
      mirthData = JSON.parse(mirthResponseText);
    } catch {
      mirthData = { message: mirthResponseText };
    }

    return NextResponse.json({
      metodo_usado: metodo,
      token_enviado: token ? "SI" : "NO",
      token_preview: token ? token.substring(0, 30) + "..." : null,
      mirth_status: mirthResponse.status,
      mirth_response: mirthData,
      url_usada: url,
      headers_enviados: headers,
      body_incluye_token: metodo === "body" || metodo === "body-auth" || metodo === "all",
      instruccion: "Revisa los logs de Mirth para ver si el token fue detectado",
    }, { status: 200 });

  } catch (error) {
    console.error("[TOKEN-DEBUG] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }, { status: 200 });
  }
}
