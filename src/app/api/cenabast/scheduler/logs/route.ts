// src/app/api/cenabast/scheduler/logs/route.ts
// Historial de ejecuciones de tareas programadas

import { NextResponse, NextRequest } from "next/server";
import { getPool, sql } from "@/lib/db";

export const runtime = "nodejs";

// Crear tablas si no existen
async function ensureLogTable(pool: any) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TBL_cenabast_scheduler_log' AND xtype='U')
      CREATE TABLE TBL_cenabast_scheduler_log (
        id INT IDENTITY(1,1) PRIMARY KEY,
        scheduler_id INT NULL,
        tipo NVARCHAR(50) NOT NULL,
        modo NVARCHAR(20) DEFAULT 'MANUAL',
        estado NVARCHAR(20) DEFAULT 'PENDIENTE',
        fecha_inicio DATETIME DEFAULT GETDATE(),
        fecha_fin DATETIME NULL,
        items_enviados INT DEFAULT 0,
        items_error INT DEFAULT 0,
        mensaje NVARCHAR(MAX) NULL,
        detalle_respuesta NVARCHAR(MAX) NULL,
        usuario NVARCHAR(100) DEFAULT 'system'
      );
    `);

    // Crear índices si no existen
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scheduler_log_fecha')
      CREATE INDEX IX_scheduler_log_fecha ON TBL_cenabast_scheduler_log(fecha_inicio DESC);
    `);
  } catch (err) {
    console.error("Error creando tabla de logs:", err);
  }
}

/**
 * GET /api/cenabast/scheduler/logs - Obtener historial de ejecuciones
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const size = parseInt(searchParams.get("size") || "15");
    const tipo = searchParams.get("tipo");
    const estado = searchParams.get("estado");
    const modo = searchParams.get("modo");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");

    const pool = await getPool();
    await ensureLogTable(pool);

    // Construir WHERE clause
    const conditions: string[] = [];
    const request = pool.request();

    if (tipo) {
      request.input("tipo", sql.NVarChar(50), tipo);
      conditions.push("tipo = @tipo");
    }
    if (estado) {
      request.input("estado", sql.NVarChar(20), estado);
      conditions.push("estado = @estado");
    }
    if (modo) {
      request.input("modo", sql.NVarChar(20), modo);
      conditions.push("modo = @modo");
    }
    if (fechaDesde) {
      request.input("fechaDesde", sql.DateTime, new Date(fechaDesde));
      conditions.push("fecha_inicio >= @fechaDesde");
    }
    if (fechaHasta) {
      request.input("fechaHasta", sql.DateTime, new Date(fechaHasta));
      conditions.push("fecha_inicio <= @fechaHasta");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Contar total
    const countResult = await request.query(`
      SELECT COUNT(1) AS total FROM TBL_cenabast_scheduler_log ${whereClause}
    `);
    const total = countResult.recordset[0]?.total || 0;

    // Obtener logs paginados
    const offset = (page - 1) * size;
    
    // Crear nuevo request para la query principal (porque los inputs ya se usaron)
    const logsRequest = pool.request();
    if (tipo) logsRequest.input("tipo", sql.NVarChar(50), tipo);
    if (estado) logsRequest.input("estado", sql.NVarChar(20), estado);
    if (modo) logsRequest.input("modo", sql.NVarChar(20), modo);
    if (fechaDesde) logsRequest.input("fechaDesde", sql.DateTime, new Date(fechaDesde));
    if (fechaHasta) logsRequest.input("fechaHasta", sql.DateTime, new Date(fechaHasta));
    logsRequest.input("offset", sql.Int, offset);
    logsRequest.input("size", sql.Int, size);

    const logsResult = await logsRequest.query(`
      SELECT 
        l.*,
        s.nombre AS tarea_nombre
      FROM TBL_cenabast_scheduler_log l
      LEFT JOIN TBL_cenabast_scheduler s ON l.scheduler_id = s.id
      ${whereClause}
      ORDER BY l.fecha_inicio DESC
      OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY
    `);

    // Estadísticas generales
    const statsResult = await pool.request().query(`
      SELECT 
        COUNT(1) AS total_ejecuciones,
        SUM(CASE WHEN estado = 'COMPLETADO' THEN 1 ELSE 0 END) AS completadas,
        SUM(CASE WHEN estado = 'ERROR' THEN 1 ELSE 0 END) AS errores,
        SUM(CASE WHEN estado IN ('PENDIENTE', 'EJECUTANDO') THEN 1 ELSE 0 END) AS en_proceso,
        SUM(ISNULL(items_enviados, 0)) AS total_items_enviados,
        SUM(ISNULL(items_error, 0)) AS total_items_error,
        MAX(fecha_inicio) AS ultima_ejecucion
      FROM TBL_cenabast_scheduler_log
    `);

    return NextResponse.json({
      logs: logsResult.recordset,
      total,
      page,
      size,
      stats: statsResult.recordset[0] || {
        total_ejecuciones: 0,
        completadas: 0,
        errores: 0,
        en_proceso: 0,
        total_items_enviados: 0,
        total_items_error: 0,
        ultima_ejecucion: null,
      },
    });
  } catch (err: any) {
    console.error("Error en GET /api/cenabast/scheduler/logs:", err);
    return NextResponse.json({
      logs: [],
      total: 0,
      page: 1,
      size: 15,
      stats: {
        total_ejecuciones: 0,
        completadas: 0,
        errores: 0,
        en_proceso: 0,
        total_items_enviados: 0,
        total_items_error: 0,
        ultima_ejecucion: null,
      },
      error: { message: err.message || "Error obteniendo logs" }
    });
  }
}

/**
 * DELETE /api/cenabast/scheduler/logs - Limpiar logs antiguos
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dias = parseInt(searchParams.get("dias") || "30");

    const pool = await getPool();
    await ensureLogTable(pool);

    const result = await pool.request()
      .input("dias", sql.Int, dias)
      .query(`
        DELETE FROM TBL_cenabast_scheduler_log 
        WHERE fecha_inicio < DATEADD(day, -@dias, GETDATE())
      `);

    return NextResponse.json({
      ok: true,
      deleted: result.rowsAffected[0],
      message: `Se eliminaron ${result.rowsAffected[0]} logs con más de ${dias} días de antigüedad`,
    });
  } catch (err: any) {
    console.error("Error en DELETE /api/cenabast/scheduler/logs:", err);
    return NextResponse.json(
      { error: { message: err.message || "Error limpiando logs" } },
      { status: 500 }
    );
  }
}
