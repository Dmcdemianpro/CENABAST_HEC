// src/app/api/cenabast/scheduler/route.ts
// Gestión de tareas programadas para envíos automáticos a CENABAST

import { NextResponse, NextRequest } from "next/server";
import { getPool, sql } from "@/lib/db";

export const runtime = "nodejs";

// Crear tablas si no existen
async function ensureSchedulerTables(pool: any) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TBL_cenabast_scheduler' AND xtype='U')
      CREATE TABLE TBL_cenabast_scheduler (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(100) NOT NULL,
        tipo NVARCHAR(50) NOT NULL,
        activo BIT DEFAULT 1,
        hora_ejecucion NVARCHAR(5) NOT NULL,
        dias_semana NVARCHAR(20) DEFAULT '1,2,3,4,5',
        id_relacion INT NULL,
        tipo_compra CHAR(1) NULL,
        ultima_ejecucion DATETIME NULL,
        proxima_ejecucion DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );
    `);

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

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scheduler_log_tipo')
      CREATE INDEX IX_scheduler_log_tipo ON TBL_cenabast_scheduler_log(tipo);
    `);
  } catch (err) {
    console.error("Error creando tablas scheduler:", err);
  }
}

/**
 * Calcular próxima ejecución basándose en hora y días de la semana
 */
function calcularProximaEjecucion(hora: string, diasSemana: string): Date {
  const [horaNum, minNum] = hora.split(":").map(Number);
  const diasArray = diasSemana.split(",").map(Number);
  const ahora = new Date();
  
  // Buscar próximo día válido
  for (let i = 0; i < 8; i++) {
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() + i);
    fecha.setHours(horaNum, minNum, 0, 0);
    
    // JavaScript: 0=Dom, 1=Lun... Nosotros: 1=Lun, 7=Dom
    let diaSemana = fecha.getDay();
    if (diaSemana === 0) diaSemana = 7; // Convertir domingo
    
    if (diasArray.includes(diaSemana)) {
      // Si es hoy, verificar que la hora no haya pasado
      if (i === 0 && fecha <= ahora) {
        continue;
      }
      return fecha;
    }
  }
  
  // Fallback: mañana a la misma hora
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  manana.setHours(horaNum, minNum, 0, 0);
  return manana;
}

/**
 * GET /api/cenabast/scheduler - Listar tareas programadas
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const incluirInactivos = searchParams.get("incluirInactivos") === "true";

    const pool = await getPool();
    await ensureSchedulerTables(pool);

    const whereClause = incluirInactivos ? "" : "WHERE activo = 1";
    
    const result = await pool.request().query(`
      SELECT 
        s.*,
        (SELECT COUNT(1) FROM TBL_cenabast_scheduler_log WHERE scheduler_id = s.id AND estado = 'COMPLETADO') AS ejecuciones_exitosas,
        (SELECT COUNT(1) FROM TBL_cenabast_scheduler_log WHERE scheduler_id = s.id AND estado = 'ERROR') AS ejecuciones_fallidas
      FROM TBL_cenabast_scheduler s
      ${whereClause}
      ORDER BY s.activo DESC, s.hora_ejecucion ASC
    `);

    return NextResponse.json({
      tareas: result.recordset,
      total: result.recordset.length,
    });
  } catch (err: any) {
    console.error("Error en GET /api/cenabast/scheduler:", err);
    return NextResponse.json({
      tareas: [],
      total: 0,
      error: { message: err.message || "Error obteniendo tareas" }
    });
  }
}

/**
 * POST /api/cenabast/scheduler - Crear nueva tarea
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, tipo, hora_ejecucion, dias_semana, id_relacion, tipo_compra, activo } = body;

    if (!nombre || !tipo || !hora_ejecucion) {
      return NextResponse.json(
        { error: { message: "nombre, tipo y hora_ejecucion son requeridos" } },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await ensureSchedulerTables(pool);

    const proximaEjecucion = calcularProximaEjecucion(hora_ejecucion, dias_semana || "1,2,3,4,5");

    const result = await pool.request()
      .input("nombre", sql.NVarChar(100), nombre)
      .input("tipo", sql.NVarChar(50), tipo)
      .input("activo", sql.Bit, activo !== false)
      .input("hora_ejecucion", sql.NVarChar(5), hora_ejecucion)
      .input("dias_semana", sql.NVarChar(20), dias_semana || "1,2,3,4,5")
      .input("id_relacion", sql.Int, id_relacion || null)
      .input("tipo_compra", sql.Char(1), tipo_compra || null)
      .input("proxima_ejecucion", sql.DateTime, proximaEjecucion)
      .query(`
        INSERT INTO TBL_cenabast_scheduler 
          (nombre, tipo, activo, hora_ejecucion, dias_semana, id_relacion, tipo_compra, proxima_ejecucion)
        OUTPUT INSERTED.*
        VALUES 
          (@nombre, @tipo, @activo, @hora_ejecucion, @dias_semana, @id_relacion, @tipo_compra, @proxima_ejecucion)
      `);

    return NextResponse.json({
      ok: true,
      tarea: result.recordset[0],
      message: "Tarea creada exitosamente",
    });
  } catch (err: any) {
    console.error("Error en POST /api/cenabast/scheduler:", err);
    return NextResponse.json(
      { error: { message: err.message || "Error creando tarea" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cenabast/scheduler - Actualizar tarea
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, nombre, tipo, hora_ejecucion, dias_semana, id_relacion, tipo_compra, activo } = body;

    if (!id) {
      return NextResponse.json(
        { error: { message: "id es requerido" } },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await ensureSchedulerTables(pool);

    // Recalcular próxima ejecución si cambia hora o días
    let proximaEjecucion = null;
    if (hora_ejecucion && dias_semana) {
      proximaEjecucion = calcularProximaEjecucion(hora_ejecucion, dias_semana);
    }

    const request = pool.request().input("id", sql.Int, id);
    
    const updates: string[] = ["updated_at = GETDATE()"];
    
    if (nombre !== undefined) {
      request.input("nombre", sql.NVarChar(100), nombre);
      updates.push("nombre = @nombre");
    }
    if (tipo !== undefined) {
      request.input("tipo", sql.NVarChar(50), tipo);
      updates.push("tipo = @tipo");
    }
    if (activo !== undefined) {
      request.input("activo", sql.Bit, activo);
      updates.push("activo = @activo");
    }
    if (hora_ejecucion !== undefined) {
      request.input("hora_ejecucion", sql.NVarChar(5), hora_ejecucion);
      updates.push("hora_ejecucion = @hora_ejecucion");
    }
    if (dias_semana !== undefined) {
      request.input("dias_semana", sql.NVarChar(20), dias_semana);
      updates.push("dias_semana = @dias_semana");
    }
    if (id_relacion !== undefined) {
      request.input("id_relacion", sql.Int, id_relacion);
      updates.push("id_relacion = @id_relacion");
    }
    if (tipo_compra !== undefined) {
      request.input("tipo_compra", sql.Char(1), tipo_compra);
      updates.push("tipo_compra = @tipo_compra");
    }
    if (proximaEjecucion) {
      request.input("proxima_ejecucion", sql.DateTime, proximaEjecucion);
      updates.push("proxima_ejecucion = @proxima_ejecucion");
    }

    const result = await request.query(`
      UPDATE TBL_cenabast_scheduler 
      SET ${updates.join(", ")}
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { error: { message: "Tarea no encontrada" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      tarea: result.recordset[0],
      message: "Tarea actualizada",
    });
  } catch (err: any) {
    console.error("Error en PUT /api/cenabast/scheduler:", err);
    return NextResponse.json(
      { error: { message: err.message || "Error actualizando tarea" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cenabast/scheduler - Eliminar tarea
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: { message: "id es requerido" } },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await ensureSchedulerTables(pool);

    // Eliminar logs asociados primero
    await pool.request()
      .input("id", sql.Int, parseInt(id))
      .query("DELETE FROM TBL_cenabast_scheduler_log WHERE scheduler_id = @id");

    // Eliminar tarea
    const result = await pool.request()
      .input("id", sql.Int, parseInt(id))
      .query("DELETE FROM TBL_cenabast_scheduler WHERE id = @id");

    return NextResponse.json({
      ok: true,
      deleted: result.rowsAffected[0] > 0,
      message: "Tarea eliminada",
    });
  } catch (err: any) {
    console.error("Error en DELETE /api/cenabast/scheduler:", err);
    return NextResponse.json(
      { error: { message: err.message || "Error eliminando tarea" } },
      { status: 500 }
    );
  }
}
