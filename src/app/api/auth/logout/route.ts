import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return NextResponse.redirect(new URL("/", request.url), 303);
}
