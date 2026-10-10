import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "./lib/session";

export async function middleware(request: NextRequest) {
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/jobs/:path*", "/api/jobs/:path*"],
};
