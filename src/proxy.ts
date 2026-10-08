import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, roleForPath } from "@/lib/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

const AUTH_PAGES = new Set(["/login", "/register"]);

/**
 * Comprobación optimista: redirige según la cookie de sesión antes de renderizar.
 * La autorización real se repite en la capa de datos (lib/auth.ts) y en cada acción/endpoint.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requiredRole = roleForPath(pathname);
  const isAuthPage = AUTH_PAGES.has(pathname);
  if (!requiredRole && !isAuthPage) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (requiredRole && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }
  if (session && (isAuthPage || (requiredRole && session.role !== requiredRole))) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*", "/admin/:path*", "/login", "/register"],
};
