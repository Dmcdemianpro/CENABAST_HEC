import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const secret = process.env.JWT_SECRET!;
const expiresIn = process.env.JWT_EXPIRES_IN || "8h";

export type JwtUser = { username: string; role: "ADMIN" | "USER" };

export function signToken(user: JwtUser) {
  return jwt.sign(user, secret, { expiresIn });
}

export function setAuthCookie(token: string) {
  cookies().set("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function getUserFromCookie(): JwtUser | null {
  const t = cookies().get("token")?.value;
  if (!t) return null;
  try {
    return jwt.verify(t, secret) as JwtUser;
  } catch {
    return null;
  }
}
