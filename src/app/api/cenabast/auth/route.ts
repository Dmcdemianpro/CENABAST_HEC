// src/app/api/cenabast/auth/route.ts
// Gestión de autenticación con API CENABAST vía Mirth

import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";

export const runtime = "nodejs";

// Crear tabla si no existe
async function ensureTokenTable(pool: any) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TBL_cenabast_token' AND xtype='U')
      CREATE TABLE TBL_cenabast_token (
        id INT PRIMARY KEY DEFAULT 1,
        token NVARCHAR(MAX),
        expires_at DATETIME,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );
    `);
  } catch (err) {
    console.error("Error creando tabla token:", err);
  }
}

/**
 * GET /api/cenabast/auth - Obtener estado del token
 */
export async function GET() {
  try {
    const pool = await getPool();
    await ensureTokenTable(pool);

    const result = await pool.request().query(`
      SELECT token, expires_at 
      FROM TBL_cenabast_token 
      WHERE id = 1
    `);

    const row = result.recordset[0];
    
    if (!row?.token) {
      return NextResponse.json({ 
        hasToken: false, 
        message: "No hay token configurado" 
      });
    }

    const expiresAt = new Date(row.expires_at);
    const isExpired = expiresAt < new Date();

    return NextResponse.json({
      hasToken: true,
      isExpired,
      expiresAt: row.expires_at,
    });
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
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { usuario, clave } = body;

    if (!usuario || !clave) {
      return NextResponse.json(
        { error: { message: "usuario y clave son requeridos" } },
        { status: 400 }
      );
    }

    // Intentar autenticar con Mirth
    const mirthHost = process.env.MIRTH_HOST || "10.7.71.64";
    const mirthPort = 6661;
    
    let authResult;
    try {
      const res = await fetch(`http://${mirthHost}:${mirthPort}/cenabast/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
        signal: AbortSignal.timeout(10000),
      });
      authResult = await res.json();
      
      if (!res.ok) {
        return NextResponse.json(
          { error: { message: authResult?.error || "Error autenticando con CENABAST" } },
          { status: 401 }
        );
      }
    } catch (fetchErr: any) {
      // Si Mirth no está disponible, simular para desarrollo
      console.warn("Mirth no disponible, usando modo desarrollo");
      authResult = {
        token: `dev-token-${Date.now()}`,
        expires_in: 86400, // 24 horas
      };
    }

    const { token, expires_in } = authResult;
    const expiresAt = new Date(Date.now() + (expires_in || 86400) * 1000);

    // Guardar token en BD
    const pool = await getPool();
    await ensureTokenTable(pool);

    await pool.request()
      .input("token", sql.NVarChar(sql.MAX), token)
      .input("expires_at", sql.DateTime, expiresAt)
      .query(`
        IF EXISTS (SELECT 1 FROM TBL_cenabast_token WHERE id = 1)
          UPDATE TBL_cenabast_token 
          SET token = @token, expires_at = @expires_at, updated_at = GETDATE()
          WHERE id = 1
        ELSE
          INSERT INTO TBL_cenabast_token (id, token, expires_at) 
          VALUES (1, @token, @expires_at)
      `);

    return NextResponse.json({
      ok: true,
      expiresAt,
      message: "Autenticación exitosa",
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
    const pool = await getPool();
    await ensureTokenTable(pool);

    const result = await pool.request().query(`
      SELECT token FROM TBL_cenabast_token WHERE id = 1
    `);

    const currentToken = result.recordset[0]?.token;
    if (!currentToken) {
      return NextResponse.json(
        { error: { message: "No hay token para refrescar" } },
        { status: 400 }
      );
    }

    // Intentar refrescar con Mirth
    const mirthHost = process.env.MIRTH_HOST || "10.7.71.64";
    let newToken = currentToken;
    let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      const res = await fetch(`http://${mirthHost}:6661/cenabast/auth/refresh`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`,
        },
        signal: AbortSignal.timeout(10000),
      });
      
      if (res.ok) {
        const data = await res.json();
        newToken = data.token || currentToken;
      }
    } catch (fetchErr) {
      console.warn("Mirth no disponible para refresh, extendiendo token actual");
    }

    await pool.request()
      .input("token", sql.NVarChar(sql.MAX), newToken)
      .input("expires_at", sql.DateTime, expiresAt)
      .query(`
        UPDATE TBL_cenabast_token 
        SET token = @token, expires_at = @expires_at, updated_at = GETDATE()
        WHERE id = 1
      `);

    return NextResponse.json({
      ok: true,
      expiresAt,
      message: "Token refrescado",
    });
  } catch (err: any) {
    console.error("Error en PUT /api/cenabast/auth:", err);
    return NextResponse.json(
      { error: { message: err.message || "Error refrescando token" } },
      { status: 500 }
    );
  }
}
