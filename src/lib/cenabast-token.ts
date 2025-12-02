// src/lib/cenabast-token.ts
// Utilidades compartidas para obtención y refresco del token CENABAST vía Mirth

import { getPool, sql } from "./db";
import { MIRTH_CONFIG } from "./mirth";

type TokenInfo = {
  token: string;
  expiresAt: Date;
  source: "db" | "refresh" | "mirth-login" | "mirth-token" | "fake";
};

const MIRTH_HOST = MIRTH_CONFIG.host;
const AUTH_PORT = MIRTH_CONFIG.ports.auth;
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutos de holgura
const MAX_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora máximo (guía)

async function ensureTokenTable(pool: any) {
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
}

async function persistToken(pool: any, token: string, expiresAt: Date) {
  await pool
    .request()
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
}

async function readToken(pool: any): Promise<{ token: string; expiresAt: Date } | null> {
  const result = await pool.request().query(`
    SELECT token, expires_at 
    FROM TBL_cenabast_token 
    WHERE id = 1
  `);

  const row = result.recordset[0];
  if (!row?.token || !row.expires_at) return null;
  return { token: row.token, expiresAt: new Date(row.expires_at) };
}

function effectiveExpiry(expiresAt: Date) {
  return Math.min(expiresAt.getTime(), Date.now() + MAX_TOKEN_TTL_MS);
}

function isExpired(expiresAt: Date) {
  return effectiveExpiry(expiresAt) - TOKEN_BUFFER_MS <= Date.now();
}

async function requestTokenFromMirth(): Promise<TokenInfo | null> {
  const serviceUser =
    process.env.MIRTH_AUTH_USER ||
    process.env.CENABAST_USER ||
    process.env.CENABAST_SERVICE_USER;
  const servicePass =
    process.env.MIRTH_AUTH_PASSWORD ||
    process.env.CENABAST_PASSWORD ||
    process.env.CENABAST_SERVICE_PASSWORD;

  const endpoints = [
    {
      url: `http://${MIRTH_HOST}:${AUTH_PORT}/cenabast/auth/token`,
      method: "GET" as const,
      body: undefined as any,
      source: "mirth-token" as const,
    },
    {
      url: `http://${MIRTH_HOST}:${AUTH_PORT}/cenabast/auth/login`,
      method: "POST" as const,
      body: serviceUser && servicePass ? { usuario: serviceUser, clave: servicePass } : {},
      source: "mirth-login" as const,
    },
  ];

  for (const attempt of endpoints) {
    try {
      const res = await fetch(attempt.url, {
        method: attempt.method,
        headers: { "Content-Type": "application/json" },
        body: attempt.method === "POST" ? JSON.stringify(attempt.body) : undefined,
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) continue;
      const data: any = await res.json().catch(() => ({}));

      const token = data?.token || data?.jwt || data?.access_token;
      const expiresIn = data?.expires_in || data?.expiresIn || 60 * 60; // 1h por defecto
      if (!token) continue;

      const expiresMs = Math.min(expiresIn * 1000, MAX_TOKEN_TTL_MS);
      const expiresAt = new Date(Date.now() + expiresMs);
      return { token, expiresAt, source: attempt.source };
    } catch {
      // probar siguiente endpoint
    }
  }

  return null;
}

async function refreshTokenFromMirth(currentToken: string): Promise<TokenInfo | null> {
  try {
    const res = await fetch(`http://${MIRTH_HOST}:${AUTH_PORT}/cenabast/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const data: any = await res.json().catch(() => ({}));
    const token = data?.token || currentToken;
    const expiresIn = data?.expires_in || 60 * 60;
    const expiresMs = Math.min(expiresIn * 1000, MAX_TOKEN_TTL_MS);
    const expiresAt = new Date(Date.now() + expiresMs);

    return { token, expiresAt, source: "refresh" };
  } catch {
    return null;
  }
}

function shouldAllowFake() {
  const fromEnv = process.env.CENABAST_FAKE_TOKEN_ENABLED;
  if (fromEnv === "false") return false;
  if (fromEnv === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function createFakeToken(): TokenInfo {
  const expiresAt = new Date(Date.now() + MAX_TOKEN_TTL_MS); // 1h
  return {
    token: `dev-fake-token-${Date.now()}`,
    expiresAt,
    source: "fake",
  };
}

export async function getValidToken(options: {
  forceNew?: boolean;
  allowRefresh?: boolean;
  allowFake?: boolean;
} = {}): Promise<TokenInfo | null> {
  const pool = await getPool();
  await ensureTokenTable(pool);

  const stored = await readToken(pool);
  if (stored && !isExpired(stored.expiresAt) && !options.forceNew) {
    return { token: stored.token, expiresAt: stored.expiresAt, source: "db" };
  }

  if (stored && options.allowRefresh !== false) {
    const refreshed = await refreshTokenFromMirth(stored.token);
    if (refreshed) {
      await persistToken(pool, refreshed.token, refreshed.expiresAt);
      return refreshed;
    }
  }

  const requested = await requestTokenFromMirth();
  if (requested) {
    await persistToken(pool, requested.token, requested.expiresAt);
    return requested;
  }

  // Fallback en entornos de desarrollo para evitar 502 si Mirth no responde
  if (options.allowFake ?? shouldAllowFake()) {
    const fake = createFakeToken();
    await persistToken(pool, fake.token, fake.expiresAt);
    console.warn("CENABAST: usando token simulado (Mirth no respondió)");
    return fake;
  }

  return null;
}

export async function getTokenStatus(): Promise<{
  hasToken: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  hoursRemaining: number | null;
  source?: TokenInfo["source"];
  message?: string;
}> {
  const pool = await getPool();
  await ensureTokenTable(pool);

  const stored = await readToken(pool);
  if (!stored) {
    return {
      hasToken: false,
      isExpired: true,
      expiresAt: null,
      hoursRemaining: null,
      message: "Sin token almacenado. Se solicitará a Mirth al primer uso.",
    };
  }

  const expiryTs = effectiveExpiry(stored.expiresAt);
  const expired = expiryTs - TOKEN_BUFFER_MS <= Date.now();
  const hoursRemaining = Math.max(0, Math.round((expiryTs - Date.now()) / (1000 * 60 * 60)));

  return {
    hasToken: true,
    isExpired: expired,
    expiresAt: new Date(expiryTs).toISOString(),
    hoursRemaining,
    source: "db",
    message: expired ? "Token expirado o próximo a expirar" : "Token vigente",
  };
}
