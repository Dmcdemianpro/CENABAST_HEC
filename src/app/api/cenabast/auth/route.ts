// src/app/api/cenabast/auth/route.ts
// Gestión de autenticación con API CENABAST vía Mirth

import { NextResponse } from "next/server";
import { getValidToken, getTokenStatus } from "@/lib/cenabast-token";

export const runtime = "nodejs";

/**
 * GET /api/cenabast/auth - Obtener estado del token
 */
export async function GET() {
  try {
    const status = await getTokenStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("Error en GET /api/cenabast/auth:", err);
    return NextResponse.json(
      { 
        hasToken: false, 
        error: { message: err.message || "Error consultando token" } 
      },
      { status: 200 } // Retornar 200 para no romper el UI
    );
  }
}

/**
 * POST /api/cenabast/auth - Autenticar con CENABAST
 */
export async function POST() {
  try {
    // Ya no pedimos credenciales en el frontend: se solicita directo a Mirth
    const tokenInfo = await getValidToken({ forceNew: true, allowFake: true });

    if (!tokenInfo) {
      return NextResponse.json(
        { error: { message: "No se pudo obtener token desde Mirth" } },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      expiresAt: tokenInfo.expiresAt.toISOString(),
      source: tokenInfo.source,
      message: "Token solicitado a Mirth",
    });
  } catch (err: any) {
    console.error("Error en POST /api/cenabast/auth:", err);
    return NextResponse.json(
      { error: { message: err.message || "Error en autenticación" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cenabast/auth - Refrescar token
 */
export async function PUT() {
  try {
    const tokenInfo = await getValidToken({ allowRefresh: true, forceNew: true, allowFake: true });

    if (!tokenInfo) {
      return NextResponse.json(
        { error: { message: "No se pudo refrescar ni solicitar token en Mirth" } },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      expiresAt: tokenInfo.expiresAt.toISOString(),
      source: tokenInfo.source,
      message: "Token actualizado",
    });
  } catch (err: any) {
    console.error("Error en PUT /api/cenabast/auth:", err);
    return NextResponse.json(
      { error: { message: err.message || "Error refrescando token" } },
      { status: 500 }
    );
  }
}
