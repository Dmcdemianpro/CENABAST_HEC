// src/app/api/cenabast/health/route.ts
// Health check de la integración con Mirth y CENABAST

import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getTokenStatus } from "@/lib/cenabast-token";

export const runtime = "nodejs";

const MIRTH_HOST = process.env.MIRTH_HOST || "10.7.71.64";
const MIRTH_PORTS = {
  auth: 6661,
  productos: 6662,
  stock: 6663,
  movimiento: 6664,
};

/**
 * Verificar si un puerto de Mirth responde
 */
async function checkMirthPort(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const res = await fetch(`http://${MIRTH_HOST}:${port}/health`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * GET /api/cenabast/health
 */
export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    status: "checking",
    components: {},
  };

  // 1. Verificar BD local
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 AS ok");
    results.components.database = { status: "ok" };
  } catch (err: any) {
    results.components.database = { 
      status: "error", 
      message: err.message || "Error conexión BD" 
    };
  }

  // 2. Verificar token CENABAST
  try {
    const tokenStatus = await getTokenStatus();
    const hoursRemaining = tokenStatus.hoursRemaining ?? 0;

    results.components.cenabast_token = {
      status: tokenStatus.hasToken
        ? tokenStatus.isExpired
          ? "error"
          : hoursRemaining < 2
          ? "warning"
          : "ok"
        : "warning",
      expires_at: tokenStatus.expiresAt,
      hours_remaining: hoursRemaining,
      message: tokenStatus.message,
    };
  } catch (err: any) {
    results.components.cenabast_token = { 
      status: "warning", 
      message: "No se pudo verificar token: " + (err.message || "Error") 
    };
  }

  // 3. Verificar canales Mirth (en paralelo con timeout corto)
  try {
    const checks = await Promise.all([
      checkMirthPort(MIRTH_PORTS.auth),
      checkMirthPort(MIRTH_PORTS.productos),
      checkMirthPort(MIRTH_PORTS.stock),
      checkMirthPort(MIRTH_PORTS.movimiento),
    ]);
    
    const mirthChannels = {
      auth: { port: MIRTH_PORTS.auth, status: checks[0] ? "ok" : "error" },
      productos: { port: MIRTH_PORTS.productos, status: checks[1] ? "ok" : "error" },
      stock: { port: MIRTH_PORTS.stock, status: checks[2] ? "ok" : "error" },
      movimiento: { port: MIRTH_PORTS.movimiento, status: checks[3] ? "ok" : "error" },
    };
    
    const allOk = checks.every(c => c);
    const someOk = checks.some(c => c);
    
    results.components.mirth = {
      host: MIRTH_HOST,
      channels: mirthChannels,
      overall: allOk ? "ok" : someOk ? "partial" : "error",
      message: allOk ? "Todos los canales activos" : 
               someOk ? "Algunos canales no responden" : 
               "Mirth no disponible",
    };
  } catch (err: any) {
    results.components.mirth = { 
      status: "error", 
      message: "Error verificando Mirth",
      host: MIRTH_HOST,
    };
  }

  // 4. Estadísticas de datos (con manejo de tablas inexistentes)
  try {
    const pool = await getPool();
    
    const statsResult = await pool.request().query(`
      SELECT 
        (SELECT COUNT(1) FROM TBL_existencias_cenabast) AS existencias,
        (SELECT COUNT(1) FROM TBL_movimientos_cenabast) AS movimientos,
        (SELECT ISNULL((SELECT COUNT(1) FROM TBL_catalogo_productos_cenabast), 0)) AS productos,
        (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast) AS ultima_existencia,
        (SELECT MAX(fechaMovimiento) FROM TBL_movimientos_cenabast) AS ultimo_movimiento
    `);

    const stats = statsResult.recordset[0];
    results.components.data = {
      status: "ok",
      counts: {
        existencias: stats?.existencias || 0,
        movimientos: stats?.movimientos || 0,
        productos: stats?.productos || 0,
      },
      latest: {
        existencia: stats?.ultima_existencia || null,
        movimiento: stats?.ultimo_movimiento || null,
      },
    };
  } catch (err: any) {
    results.components.data = { 
      status: "warning", 
      message: "No se pudieron obtener estadísticas" 
    };
  }

  // 5. Últimas operaciones CENABAST
  try {
    const pool = await getPool();
    
    // Verificar si existe la tabla de auditoría
    const auditCheck = await pool.request().query(`
      SELECT OBJECT_ID('TBL_auditoria', 'U') AS table_exists
    `);
    
    if (auditCheck.recordset[0]?.table_exists) {
      const auditResult = await pool.request().query(`
        SELECT TOP 5 accion, detalle, fecha
        FROM TBL_auditoria
        WHERE accion LIKE 'INFORMAR%' OR accion LIKE 'SET_REGLAS%'
        ORDER BY fecha DESC
      `);
      results.components.recent_operations = auditResult.recordset;
    } else {
      results.components.recent_operations = [];
    }
  } catch {
    results.components.recent_operations = [];
  }

  // Determinar estado general
  const dbOk = results.components.database?.status === "ok";
  const tokenOk = results.components.cenabast_token?.status === "ok";
  const mirthOk = results.components.mirth?.overall === "ok";
  const dataOk = results.components.data?.status === "ok";

  if (dbOk && tokenOk && mirthOk && dataOk) {
    results.status = "healthy";
  } else if (dbOk) {
    results.status = "degraded";
  } else {
    results.status = "unhealthy";
  }

  // Siempre retornar 200 para no romper el UI
  return NextResponse.json(results, { status: 200 });
}
