import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getPool, sql } from "@/lib/db";

export const runtime = "nodejs";

// -----------------------
// Helper: compat Next 14/16
// -----------------------
async function getCookieStore() {
  const store = cookies();
  // Next 16 devuelve Promise, Next 14 devuelve objeto directo.
  return typeof (store as any).then === "function" ? await (store as any) : store;
}

async function getUserFromCookie() {
  const store = await getCookieStore();
  const token = store.get("auth")?.value;

  // auth dummy: si no hay token, igual permitimos y marcamos "manual"
  if (!token) return { username: "manual" };

  // Si después metes JWT real, acá lo decodificas/validas
  // por ahora solo retorna placeholder
  return { username: "user-cookie" };
}

// -----------------------
// Validación body PUT
// -----------------------
const bodySchema = z.object({
  codigo: z.string().min(1),
  codigo_zgen: z.string().nullable().optional(),
  descripcion: z.string().min(1),
  unidad_medida: z.string().nullable().optional(),
  familia: z.string().nullable().optional(),
  subfamilia: z.string().nullable().optional(),
  activo: z.coerce.boolean().optional().default(true),
});

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id_producto: string }> }
) {
  try {
    const { id_producto } = await ctx.params;
    const id = Number(id_producto);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: { message: "id_producto inválido" } },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await getUserFromCookie();

    const pool = await getPool();
    const request = pool.request();

    request.input("id_producto", sql.Int, id);
    request.input("codigo", sql.VarChar(50), parsed.data.codigo);
    request.input("codigo_zgen", sql.VarChar(50), parsed.data.codigo_zgen ?? null);
    request.input("descripcion", sql.VarChar(255), parsed.data.descripcion);
    request.input("unidad_medida", sql.VarChar(50), parsed.data.unidad_medida ?? null);
    request.input("familia", sql.VarChar(100), parsed.data.familia ?? null);
    request.input("subfamilia", sql.VarChar(100), parsed.data.subfamilia ?? null);
    request.input("activo", sql.Bit, parsed.data.activo ? 1 : 0);
    request.input("usuario_actualiza", sql.VarChar(100), user.username);

    const query = `
UPDATE dbCenabast.dbo.TBL_catalogo_productos_cenabast
SET
  codigo = @codigo,
  codigo_zgen = @codigo_zgen,
  descripcion = @descripcion,
  unidad_medida = @unidad_medida,
  familia = @familia,
  subfamilia = @subfamilia,
  activo = @activo,
  fecha_actualiza = GETDATE(),
  usuario_actualiza = @usuario_actualiza
WHERE id_producto = @id_producto;

SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);
    const affected = result.recordset?.[0]?.affected ?? 0;

    if (affected === 0) {
      return NextResponse.json(
        { error: { message: "Producto no encontrado" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, id_producto: id });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message ?? "Error actualizando catálogo" } },
      { status: 500 }
    );
  }
}

// DELETE lógico (por si lo tienes también acá)
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id_producto: string }> }
) {
  try {
    const { id_producto } = await ctx.params;
    const id = Number(id_producto);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: { message: "id_producto inválido" } },
        { status: 400 }
      );
    }

    const user = await getUserFromCookie();

    const pool = await getPool();
    const request = pool.request();

    request.input("id_producto", sql.Int, id);
    request.input("usuario_actualiza", sql.VarChar(100), user.username);

    const query = `
UPDATE dbCenabast.dbo.TBL_catalogo_productos_cenabast
SET
  activo = 0,
  fecha_actualiza = GETDATE(),
  usuario_actualiza = @usuario_actualiza
WHERE id_producto = @id_producto;

SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);
    const affected = result.recordset?.[0]?.affected ?? 0;

    if (affected === 0) {
      return NextResponse.json(
        { error: { message: "Producto no encontrado" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, id_producto: id });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message ?? "Error eliminando catálogo" } },
      { status: 500 }
    );
  }
}
