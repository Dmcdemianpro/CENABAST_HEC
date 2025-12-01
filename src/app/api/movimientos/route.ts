import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { movimientosFiltersSchema } from "@/lib/validators";
import { safeSort, MOVIMIENTOS_SORT_WHITELIST } from "@/lib/sql";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = movimientosFiltersSchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    fechaDesde, fechaHasta, bodega, tipoDocumento, rut, nombre, codigo,
    numero_lote, vencDesde, vencHasta, page, size, sort, dir,
  } = parsed.data;

  const { sort: sSort, dir: sDir } = safeSort(sort ?? null, dir ?? null, MOVIMIENTOS_SORT_WHITELIST);

  const pool = await getPool();
  const request = pool.request();

  request.input("fechaDesde", sql.Date, fechaDesde ? new Date(fechaDesde) : null);
  request.input("fechaHasta", sql.Date, fechaHasta ? new Date(fechaHasta) : null);
  request.input("bodega", sql.NVarChar(50), bodega ?? null);
  request.input("tipoDocumento", sql.NVarChar(50), tipoDocumento ?? null);
  request.input("rut", sql.NVarChar(20), rut ?? null);
  request.input("nombre", sql.NVarChar(150), nombre ?? null);
  request.input("codigo", sql.NVarChar(50), codigo ?? null);
  request.input("numero_lote", sql.NVarChar(50), numero_lote ?? null);
  request.input("vencDesde", sql.Date, vencDesde ? new Date(vencDesde) : null);
  request.input("vencHasta", sql.Date, vencHasta ? new Date(vencHasta) : null);
  request.input("page", sql.Int, page);
  request.input("size", sql.Int, size);
  request.input("sort", sql.NVarChar(50), sSort);
  request.input("dir", sql.NVarChar(4), sDir);

  const query = `
DECLARE @offset INT = (@page - 1) * @size;

SELECT
    m.id_movimiento,
    m.fecha_registro,
    m.fechaDesde,
    m.fechaHasta,
    m.bodega,
    m.tipoDocumento,
    m.numero,
    m.fechaMovimiento,
    m.rut,
    m.nombre,
    m.codigo,
    m.codigo_zgen,
    m.descripcion,
    m.numero_lote,
    m.vencimiento,
    m.cantidad,
    total_count = COUNT(1) OVER()
FROM dbCenabast.dbo.TBL_movimientos_cenabast m
WHERE
    (@fechaDesde IS NULL OR m.fechaMovimiento >= @fechaDesde)
    AND (@fechaHasta IS NULL OR m.fechaMovimiento < DATEADD(DAY, 1, @fechaHasta))
    AND (@bodega IS NULL OR CAST(m.bodega AS NVARCHAR(50)) = @bodega)
    AND (@tipoDocumento IS NULL OR m.tipoDocumento = @tipoDocumento)
    AND (@rut IS NULL OR m.rut LIKE '%' + @rut + '%')
    AND (@nombre IS NULL OR m.nombre LIKE '%' + @nombre + '%')
    AND (@codigo IS NULL OR m.codigo LIKE '%' + @codigo + '%'
                      OR m.codigo_zgen LIKE '%' + @codigo + '%'
                      OR m.descripcion LIKE '%' + @codigo + '%')
    AND (@numero_lote IS NULL OR m.numero_lote LIKE '%' + @numero_lote + '%')
    AND (@vencDesde IS NULL OR m.vencimiento >= @vencDesde)
    AND (@vencHasta IS NULL OR m.vencimiento < DATEADD(DAY, 1, @vencHasta))
ORDER BY
    CASE WHEN @sort='fechaMovimiento' AND @dir='asc'  THEN m.fechaMovimiento END ASC,
    CASE WHEN @sort='fechaMovimiento' AND @dir='desc' THEN m.fechaMovimiento END DESC,
    CASE WHEN @sort='tipoDocumento'   AND @dir='asc'  THEN m.tipoDocumento END ASC,
    CASE WHEN @sort='tipoDocumento'   AND @dir='desc' THEN m.tipoDocumento END DESC,
    CASE WHEN @sort='bodega'          AND @dir='asc'  THEN m.bodega END ASC,
    CASE WHEN @sort='bodega'          AND @dir='desc' THEN m.bodega END DESC,
    CASE WHEN @sort='codigo'          AND @dir='asc'  THEN m.codigo END ASC,
    CASE WHEN @sort='codigo'          AND @dir='desc' THEN m.codigo END DESC,
    CASE WHEN @sort='cantidad'        AND @dir='asc'  THEN m.cantidad END ASC,
    CASE WHEN @sort='cantidad'        AND @dir='desc' THEN m.cantidad END DESC,
    m.id_movimiento DESC
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
