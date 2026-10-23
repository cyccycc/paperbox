const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().toLowerCase();
  return first || null;
}

function hostnameOf(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return (end === -1 ? host : host.slice(1, end)).toLowerCase();
  }
  const colon = host.lastIndexOf(":");
  if (colon > -1 && host.indexOf(":") === colon) return host.slice(0, colon).toLowerCase();
  return host.toLowerCase();
}

function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(hostnameOf(host));
}

/** Host headers are copied from the proxy. Reject anything that is not a host[:port]. */
function isSafeHost(host: string): boolean {
  const match = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::(\d{1,5}))?$/.exec(host);
  if (!match) return false;
  if (match[2] && Number(match[2]) > 65535) return false;
  return true;
}

function usableHost(value: string | null): string | null {
  if (!value || !isSafeHost(value)) return null;
  return value;
}

function parseHttpOrigin(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!isSafeHost(url.host)) return null;
    return url;
  } catch {
    return null;
  }
}

function configuredOrigin(env: NodeJS.ProcessEnv): URL | null {
  const raw = (env.AUTH_URL ?? env.NEXTAUTH_URL ?? "").trim();
  return parseHttpOrigin(raw);
}

function sameHost(origin: URL, host: string): boolean {
  return origin.host.toLowerCase() === host;
}

function schemeFor(
  host: string,
  forwardedProto: string | null,
  origin: URL | null,
): "http" | "https" {
  if (forwardedProto === "https") return "https";
  // A browser form POST carries the page's real scheme. `next start` fills in
  // `x-forwarded-proto: http` when the proxy forgot it, because the app socket
  // itself is plain HTTP. Prefer the matching Origin so HTTPS does not drop to HTTP.
  if (origin && sameHost(origin, host) && origin.protocol === "https:") return "https";
  if (forwardedProto === "http") return "http";
  if (origin && sameHost(origin, host)) return "http";
  return "https";
}

/**
 * Location for a same-origin redirect such as logout.
 *
 * `next start` sets `request.url` from the listen address (`localhost:3000`),
 * even when nginx forwarded the public Host. Redirecting to that URL sends
 * the browser to localhost. Use the public host from this request instead.
 *
 * Returns a relative path when every host we can see is loopback and no
 * public `AUTH_URL` is configured. The browser then stays on the origin it
 * actually called, which is also correct for local development.
 */
export function sameOriginLocation(
  request: Request,
  pathname = "/",
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\")) {
    throw new Error("Redirect path must stay on this site.");
  }

  const host = usableHost(firstHeaderValue(request.headers.get("host")));
  const forwardedHost = usableHost(firstHeaderValue(request.headers.get("x-forwarded-host")));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const origin = parseHttpOrigin(request.headers.get("origin"));

  // Prefer Host. nginx replaces it with `$host`, so a client cannot spoof it.
  // X-Forwarded-Host is only used when Host is the internal bind address.
  const publicHost =
    (host && !isLoopbackHost(host) ? host : null) ??
    (forwardedHost && !isLoopbackHost(forwardedHost) ? forwardedHost : null);

  if (publicHost) {
    return new URL(pathname, `${schemeFor(publicHost, forwardedProto, origin)}://${publicHost}`).toString();
  }

  if (env.NODE_ENV === "production") {
    const configured = configuredOrigin(env);
    if (configured && !isLoopbackHost(configured.host)) {
      return new URL(pathname, configured.origin).toString();
    }
  }

  return pathname;
}
