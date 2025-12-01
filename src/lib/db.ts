// src/lib/db.ts
import * as sql from "mssql";

const config: sql.config = {
  user: process.env.SQL_USER!,
  password: process.env.SQL_PASSWORD!,
  server: process.env.SQL_HOST!,
  port: Number(process.env.SQL_PORT || 1433),
  database: process.env.SQL_DB!,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

export { sql };
