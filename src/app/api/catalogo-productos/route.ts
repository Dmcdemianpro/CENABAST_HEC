import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sql from "mssql";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

const sortWhitelist = new Set([
  "codigo",
  "descripcion",
  "familia",
  "activo",
  "id_producto",
]);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().default("codigo"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  codigo: z.string().optional().transform((v) => v?.trim() || undefined),
  descripcion: z.string().optional().transform((v) => v?.trim() || undefined),
  familia: z.string().optional().transform((v) => v?.trim() || undefined),
  activo: z
    .coerce
    .number()
    .int()
    .optional()
    .transform((v) => (v === 0 || v === 1 ? v : undefined)),
});

const bodySchema = z.object({
  codigo: z.string().min(1),
  codigo_zgen: z.string().optional().nullable(),
  descripcion: z.string().min(1),
  unidad_medida: z.string().optional().nullable(),
  familia: z.string().optional().nullable(),
  subfamilia: z.string().optional().nullable(),
  usuario_actualiza: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    const page = parsed.page;
    const size = parsed.size;
    const sort = sortWhitelist.has(parsed.sort) ? parsed.sort : "codigo";
    const dir = parsed.dir;

    const pool = await getPool();
    const request = pool.request();

    request.input("page", sql.Int, page);
    request.input("size", sql.Int, size);
    request.input("sort", sql.VarChar(50), sort);
    request.input("dir", sql.VarChar(4), dir);

    request.input("codigo", sql.VarChar(50), parsed.codigo ?? null);
    request.input("descripcion", sql.VarChar(255), parsed.descripcion ?? null);
    request.input("familia", sql.VarChar(100), parsed.familia ?? null);

    // BIT acepta null
    request.input(
      "activo",
      sql.Bit,
      parsed.activo === undefined ? null : parsed.activo
    );

    const result = await request.query(`
      DECLARE @offset INT = (@page - 1) * @size;

      SELECT
          c.id_producto,
          c.codigo,
          c.codigo_zgen,
          c.descripcion,
          c.unidad_medida,
          c.familia,
          c.subfamilia,
          c.activo,
          c.fecha_creacion,
          c.fecha_actualiza,
          c.usuario_actualiza,
          total_count = COUNT(1) OVER()
      FROM dbCenabast.dbo.TBL_catalogo_productos_cenabast c
      WHERE
          (@codigo IS NULL OR c.codigo LIKE '%' + @codigo + '%'
                         OR c.codigo_zgen LIKE '%' + @codigo + '%')
          AND (@descripcion IS NULL OR c.descripcion LIKE '%' + @descripcion + '%')
          AND (@familia IS NULL OR c.familia = @familia)
          AND (@activo IS NULL OR c.activo = @activo)
      ORDER BY
          CASE WHEN @sort='codigo'      AND @dir='asc'  THEN c.codigo END ASC,
          CASE WHEN @sort='codigo'      AND @dir='desc' THEN c.codigo END DESC,
          CASE WHEN @sort='descripcion' AND @dir='asc'  THEN c.descripcion END ASC,
          CASE WHEN @sort='descripcion' AND @dir='desc' THEN c.descripcion END DESC,
          CASE WHEN @sort='familia'     AND @dir='asc'  THEN c.familia END ASC,
          CASE WHEN @sort='familia'     AND @dir='desc' THEN c.familia END DESC,
          CASE WHEN @sort='activo'      AND @dir='asc'  THEN c.activo END ASC,
          CASE WHEN @sort='activo'      AND @dir='desc' THEN c.activo END DESC,
          c.id_producto DESC
      OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;
    `);

    const rows = result.recordset ?? [];
    const total = rows[0]?.total_count ?? 0;

    const data = rows.map(({ total_count, ...r }) => r);

    return NextResponse.json({ data, total, page, size });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message ?? "Error en catálogo" } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());

    const pool = await getPool();
    const request = pool.request();

    request.input("codigo", sql.VarChar(50), body.codigo);
    request.input("codigo_zgen", sql.VarChar(50), body.codigo_zgen ?? null);
    request.input("descripcion", sql.VarChar(255), body.descripcion);
    request.input("unidad_medida", sql.VarChar(50), body.unidad_medida ?? null);
    request.input("familia", sql.VarChar(100), body.familia ?? null);
    request.input("subfamilia", sql.VarChar(100), body.subfamilia ?? null);
    request.input(
      "usuario_actualiza",
      sql.VarChar(100),
      body.usuario_actualiza ?? "system"
    );

    const result = await request.query(`
      INSERT INTO dbCenabast.dbo.TBL_catalogo_productos_cenabast
      (
        codigo, codigo_zgen, descripcion,
        unidad_medida, familia, subfamilia,
        activo, fecha_creacion, usuario_actualiza
      )
      VALUES
      (
        @codigo, @codigo_zgen, @descripcion,
        @unidad_medida, @familia, @subfamilia,
        1, GETDATE(), @usuario_actualiza
      );
      SELECT SCOPE_IDENTITY() AS id_producto;
    `);

    return NextResponse.json({
      id_producto: result.recordset?.[0]?.id_producto,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message ?? "Error creando producto" } },
      { status: 400 }
    );
  }
}
