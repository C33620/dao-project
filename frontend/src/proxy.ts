import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "govboard_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAppRoute = pathname.startsWith("/app");
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isAppRoute && !hasSessionCookie) {
    const authUrl = new URL("/auth", request.url);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/auth"],
};
