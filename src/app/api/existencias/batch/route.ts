import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { batchExistenciasSchema } from "@/lib/validators";
import { getUserFromCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const user = getUserFromCookie();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = batchExistenciasSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updatesJson = JSON.stringify(parsed.data.updates);

  const pool = await getPool();
  const request = pool.request();
  request.input("updatesJson", sql.NVarChar(sql.MAX), updatesJson);

  const query = `
UPDATE e
SET
    e.stock_minimo = u.stock_minimo,
    e.stock_critico = u.stock_critico,
    e.stock_maximo = u.stock_maximo,
    e.fechaCarga = GETDATE()
FROM dbCenabast.dbo.TBL_existencias_cenabast e
JOIN OPENJSON(@updatesJson)
WITH (
    id INT '$.id',
    stock_minimo FLOAT '$.stock_minimo',
    stock_critico FLOAT '$.stock_critico',
    stock_maximo FLOAT '$.stock_maximo'
) u
ON e.id = u.id;
`;

  await request.query(query);

  // auditoría simple (opcional): registrar batch
  await pool.request()
    .input("usuario", sql.NVarChar(100), user.username)
    .input("cantidad", sql.Int, parsed.data.updates.length)
    .query(`
      IF OBJECT_ID('dbCenabast.dbo.TBL_auditoria', 'U') IS NULL
      CREATE TABLE dbCenabast.dbo.TBL_auditoria(
        id INT IDENTITY PRIMARY KEY,
        usuario VARCHAR(100),
        accion VARCHAR(50),
        detalle VARCHAR(255),
        fecha DATETIME DEFAULT GETDATE()
      );
      INSERT INTO dbCenabast.dbo.TBL_auditoria(usuario, accion, detalle)
      VALUES (@usuario,'PATCH_EXISTENCIAS_BATCH', CONCAT('updates=',@cantidad));
    `);

  return NextResponse.json({ ok: true });
}
