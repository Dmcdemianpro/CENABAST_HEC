import { NextRequest, NextResponse } from "next/server";

// Autenticación deshabilitada: la app queda accesible sin login.
export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
