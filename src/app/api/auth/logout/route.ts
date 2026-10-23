import { NextResponse } from "next/server";
import { sameOriginLocation } from "@/lib/request-origin";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const location = sameOriginLocation(request);
  const response = location.startsWith("/")
    ? new NextResponse(null, { status: 303, headers: { Location: location } })
    : NextResponse.redirect(location, 303);
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
