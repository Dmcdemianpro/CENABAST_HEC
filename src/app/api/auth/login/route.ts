import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validators";
import { signToken, setAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

const USERS = [
  { username: "admin", password: "admin123", role: "ADMIN" as const },
  { username: "user", password: "user123", role: "USER" as const },
];

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { username, password } = parsed.data;
  const found = USERS.find(u => u.username === username && u.password === password);
  if (!found) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

  const token = signToken({ username: found.username, role: found.role });
  setAuthCookie(token);

  return NextResponse.json({ ok: true, user: { username: found.username, role: found.role } });
}
