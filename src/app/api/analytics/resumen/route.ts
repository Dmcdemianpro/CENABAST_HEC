import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { existenciasFiltersSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = existenciasFiltersSchema.omit({ page: true, size: true, sort: true, dir: true })
    .safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { fechaDesde, fechaHasta, bodega, comuna, hospital, codigo } = parsed.data;
  const pool = await getPool();

  const baseReq = pool.request()
    .input("fechaDesde", sql.Date, fechaDesde ? new Date(fechaDesde) : null)
    .input("fechaHasta", sql.Date, fechaHasta ? new Date(fechaHasta) : null)
    .input("bodega", sql.NVarChar(50), bodega ?? null)
    .input("comuna", sql.NVarChar(100), comuna ?? null)
    .input("hospital", sql.NVarChar(150), hospital ?? null)
    .input("codigo", sql.NVarChar(50), codigo ?? null);

  const kpiExist = await baseReq.query(`
SELECT
  stock_critico_count = SUM(CASE WHEN e.existencia <= e.stock_critico THEN 1 ELSE 0 END),
  stock_minimo_count  = SUM(CASE WHEN e.existencia <= e.stock_minimo  THEN 1 ELSE 0 END)
FROM dbCenabast.dbo.TBL_existencias_cenabast e
WHERE
  (@fechaDesde IS NULL OR e.fechaCorte >= @fechaDesde)
  AND (@fechaHasta IS NULL OR e.fechaCorte < DATEADD(DAY,1,@fechaHasta))
  AND (@bodega IS NULL OR CAST(e.bodega AS NVARCHAR(50)) = @bodega)
  AND (@comuna IS NULL OR e.comuna = @comuna)
  AND (@hospital IS NULL OR e.hospital = @hospital)
  AND (@codigo IS NULL OR e.codigo LIKE '%' + @codigo + '%'
                     OR e.codigo_zgen LIKE '%' + @codigo + '%');
`);

  const kpiMov = await baseReq.query(`
SELECT
  movimientos_total = COUNT(1)
FROM dbCenabast.dbo.TBL_movimientos_cenabast m
WHERE
  (@fechaDesde IS NULL OR m.fechaMovimiento >= @fechaDesde)
  AND (@fechaHasta IS NULL OR m.fechaMovimiento < DATEADD(DAY,1,@fechaHasta))
  AND (@bodega IS NULL OR CAST(m.bodega AS NVARCHAR(50)) = @bodega)
  AND (@codigo IS NULL OR m.codigo LIKE '%' + @codigo + '%'
                     OR m.codigo_zgen LIKE '%' + @codigo + '%');
`);

  const topRot = await baseReq.query(`
SELECT TOP 10
  m.codigo,
  m.codigo_zgen,
  m.descripcion,
  rotacion = SUM(m.cantidad)
FROM dbCenabast.dbo.TBL_movimientos_cenabast m
WHERE
  (@fechaDesde IS NULL OR m.fechaMovimiento >= @fechaDesde)
  AND (@fechaHasta IS NULL OR m.fechaMovimiento < DATEADD(DAY,1,@fechaHasta))
  AND (@bodega IS NULL OR CAST(m.bodega AS NVARCHAR(50)) = @bodega)
GROUP BY m.codigo, m.codigo_zgen, m.descripcion
ORDER BY rotacion DESC;
`);

  return NextResponse.json({
    kpis: { ...kpiExist.recordset[0], ...kpiMov.recordset[0] },
    topRotacion: topRot.recordset,
  });
}
