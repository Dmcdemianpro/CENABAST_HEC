import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { existenciasFiltersSchema } from "@/lib/validators";
import { safeSort, EXISTENCIAS_SORT_WHITELIST } from "@/lib/sql";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = existenciasFiltersSchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    fechaDesde, fechaHasta, comuna, hospital, bodega, codigo, descripcion,
    soloConExistencia,
    page, size, sort, dir,
  } = parsed.data;

  const { sort: sSort, dir: sDir } = safeSort(sort ?? null, dir ?? null, EXISTENCIAS_SORT_WHITELIST);

  const pool = await getPool();
  const request = pool.request();

  request.input("fechaDesde", sql.Date, fechaDesde ? new Date(fechaDesde) : null);
  request.input("fechaHasta", sql.Date, fechaHasta ? new Date(fechaHasta) : null);
  request.input("comuna", sql.NVarChar(100), comuna ?? null);
  request.input("hospital", sql.NVarChar(150), hospital ?? null);
  request.input("bodega", sql.NVarChar(50), bodega ?? null);
  request.input("codigo", sql.NVarChar(50), codigo ?? null);
  request.input("descripcion", sql.NVarChar(255), descripcion ?? null);
  request.input("soloConExistencia", sql.Bit, soloConExistencia ? 1 : 0);
  request.input("page", sql.Int, page);
  request.input("size", sql.Int, size);
  request.input("sort", sql.NVarChar(50), sSort);
  request.input("dir", sql.NVarChar(4), sDir);

  const query = `
DECLARE @offset INT = (@page - 1) * @size;

SELECT
    e.id,
    e.fechaCorte,
    e.comuna,
    e.hospital,
    e.bodega,
    e.codigo,
    e.codigo_zgen,
    e.descripcion,
    e.existencia,
    e.stock_minimo,
    e.stock_critico,
    e.stock_maximo,
    e.fechaCarga,
    total_count = COUNT(1) OVER()
FROM dbCenabast.dbo.TBL_existencias_cenabast e
WHERE
    (@fechaDesde IS NULL OR e.fechaCorte >= @fechaDesde)
    AND (@fechaHasta IS NULL OR e.fechaCorte < DATEADD(DAY, 1, @fechaHasta))
    AND (@comuna IS NULL OR e.comuna = @comuna)
    AND (@hospital IS NULL OR e.hospital = @hospital)
    AND (@bodega IS NULL OR CAST(e.bodega AS NVARCHAR(50)) = @bodega)
    AND (@codigo IS NULL OR e.codigo LIKE '%' + @codigo + '%'
                      OR e.codigo_zgen LIKE '%' + @codigo + '%')
    AND (@descripcion IS NULL OR e.descripcion LIKE '%' + @descripcion + '%')
    AND (@soloConExistencia = 0 OR e.existencia > 0)
ORDER BY
    CASE WHEN @sort='fechaCorte'   AND @dir='asc'  THEN e.fechaCorte END ASC,
    CASE WHEN @sort='fechaCorte'   AND @dir='desc' THEN e.fechaCorte END DESC,
    CASE WHEN @sort='fechaCarga'   AND @dir='asc'  THEN e.fechaCarga END ASC,
    CASE WHEN @sort='fechaCarga'   AND @dir='desc' THEN e.fechaCarga END DESC,
    CASE WHEN @sort='existencia'   AND @dir='asc'  THEN e.existencia END ASC,
    CASE WHEN @sort='existencia'   AND @dir='desc' THEN e.existencia END DESC,
    CASE WHEN @sort='codigo'       AND @dir='asc'  THEN e.codigo END ASC,
    CASE WHEN @sort='codigo'       AND @dir='desc' THEN e.codigo END DESC,
    CASE WHEN @sort='bodega'       AND @dir='asc'  THEN e.bodega END ASC,
    CASE WHEN @sort='bodega'       AND @dir='desc' THEN e.bodega END DESC,
    CASE WHEN @sort='hospital'     AND @dir='asc'  THEN e.hospital END ASC,
    CASE WHEN @sort='hospital'     AND @dir='desc' THEN e.hospital END DESC,
    CASE WHEN @sort='comuna'       AND @dir='asc'  THEN e.comuna END ASC,
    CASE WHEN @sort='comuna'       AND @dir='desc' THEN e.comuna END DESC,
    e.id DESC
OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;
`;

  const result = await request.query(query);
  const rows = result.recordset;
  const total = rows[0]?.total_count ?? 0;

  return NextResponse.json({
    data: rows.map(({ total_count, ...r }) => r),
    total,
    page,
    size,
  });
}
