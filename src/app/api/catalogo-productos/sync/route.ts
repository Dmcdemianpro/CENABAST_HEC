import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  mode: z.enum(["incremental", "full"]).optional().default("incremental"),
});

// seguridad simple para cron/manual
function assertCronOrUser(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  // si tienes CRON_SECRET, exige Bearer CRON_SECRET (pero en dev permite manual)
  if (cronSecret) {
    if (auth === `Bearer ${cronSecret}`) return;
    if (process.env.NODE_ENV !== "production") return;
    throw new Error("No autorizado");
  }

  // si NO hay CRON_SECRET configurado, permite manual
  return;
}

export async function POST(req: Request) {
  try {
    assertCronOrUser(req);

    const body = await req.json().catch(() => ({}));
    const { mode } = bodySchema.parse(body);

    const pool = await getPool();
    const request = pool.request();

    const baseSrcCte = `
      ;WITH src AS (
        SELECT
          LTRIM(RTRIM(codigo)) AS codigo,
          MAX(NULLIF(LTRIM(RTRIM(codigo_zgen)), '')) AS codigo_zgen,
          MAX(LEFT(NULLIF(LTRIM(RTRIM(descripcion)),''), 255)) AS descripcion
        FROM (
          SELECT codigo, codigo_zgen, descripcion
          FROM dbCenabast.dbo.TBL_existencias_cenabast
          WHERE codigo IS NOT NULL

          UNION ALL

          SELECT codigo, codigo_zgen, descripcion
          FROM dbCenabast.dbo.TBL_movimientos_cenabast
          WHERE codigo IS NOT NULL
        ) x
        GROUP BY LTRIM(RTRIM(codigo))
      )
    `;

    const queryIncremental = `
      ${baseSrcCte}

      INSERT INTO dbCenabast.dbo.TBL_catalogo_productos_cenabast
      (
        codigo, codigo_zgen, descripcion,
        unidad_medida, familia, subfamilia,
        activo, fecha_creacion, usuario_actualiza
      )
      SELECT
        s.codigo,
        s.codigo_zgen,
        s.descripcion,
        NULL, NULL, NULL,
        1, GETDATE(), 'sync-cron'
      FROM src s
      LEFT JOIN dbCenabast.dbo.TBL_catalogo_productos_cenabast c
        ON c.codigo = s.codigo
      WHERE c.codigo IS NULL;

      SELECT @@ROWCOUNT AS inserted, 0 AS updated;
    `;

    const queryFull = `
      ${baseSrcCte}

      DECLARE @actions TABLE(action NVARCHAR(10));

      MERGE dbCenabast.dbo.TBL_catalogo_productos_cenabast AS t
      USING src AS s
      ON t.codigo = s.codigo
      WHEN MATCHED THEN
        UPDATE SET
          t.codigo_zgen = COALESCE(NULLIF(t.codigo_zgen,''), s.codigo_zgen),
          t.descripcion = COALESCE(NULLIF(t.descripcion,''), s.descripcion),
          t.activo = 1,
          t.fecha_actualiza = GETDATE(),
          t.usuario_actualiza = 'sync-cron'
      WHEN NOT MATCHED THEN
        INSERT (
          codigo, codigo_zgen, descripcion,
          unidad_medida, familia, subfamilia,
          activo, fecha_creacion, usuario_actualiza
        )
        VALUES (
          s.codigo, s.codigo_zgen, s.descripcion,
          NULL, NULL, NULL,
          1, GETDATE(), 'sync-cron'
        )
      OUTPUT $action INTO @actions;

      SELECT
        inserted = SUM(CASE WHEN action='INSERT' THEN 1 ELSE 0 END),
        updated  = SUM(CASE WHEN action='UPDATE' THEN 1 ELSE 0 END)
      FROM @actions;
    `;

    const result =
      mode === "full"
        ? await request.query(queryFull)
        : await request.query(queryIncremental);

    const inserted = result.recordset?.[0]?.inserted ?? 0;
    const updated = result.recordset?.[0]?.updated ?? 0;

    return NextResponse.json({
      ok: true,
      mode,
      inserted,
      updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message ?? "Error sync catálogo" } },
      { status: 400 }
    );
  }
}
