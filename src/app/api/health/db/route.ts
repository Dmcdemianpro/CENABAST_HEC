import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = await getPool();
    const r = await pool.request().query("SELECT 1 AS ok");
    return NextResponse.json({ db: "ok", result: r.recordset[0] });
  } catch (e: any) {
    return NextResponse.json(
      { db: "fail", message: e.message },
      { status: 500 }
    );
  }
}
