import { prisma } from "./db";
import { cookieFromHeader, readSession, SESSION_COOKIE } from "./session";

export async function adminFromRequest(request: Request) {
  const session = await readSession(cookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE));
  if (!session) return { ok: false as const, status: 401 as const };
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { id: true, email: true, isAdmin: true },
  });
  if (!user?.isAdmin) return { ok: false as const, status: 404 as const };
  return { ok: true as const, user };
}
