import { NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defense-in-depth CSRF guard for the API surface.
 *
 * The primary CSRF defense is the session cookie itself (httpOnly,
 * SameSite=Lax - browsers do not attach it to cross-site POST/PUT/PATCH/
 * DELETE requests). This middleware adds a second, independent check: for
 * every mutating request to /api/*, if an Origin header is present, it must
 * match this deployment's own origin. Requests that omit Origin entirely
 * (some non-browser clients, or older browsers on some requests) are not
 * blocked here since the cookie policy already covers them - this check
 * exists to catch cases where SameSite enforcement might be bypassed
 * (e.g. a misconfigured proxy stripping cookie attributes).
 *
 * IMPORTANT for reverse-proxy deployments: req.nextUrl.origin is derived
 * from the Host header (and protocol) the request arrives with at the
 * Next.js process. If your reverse proxy (nginx, etc.) doesn't forward the
 * original Host / X-Forwarded-Proto headers, Next.js will think its own
 * origin is something like http://127.0.0.1:3000 even though the browser is
 * correctly sending Origin: https://yourdomain.com - a false mismatch that
 * rejects every real login. Set APP_ORIGIN explicitly (e.g.
 * https://finance.emrs.ae) in production so this check doesn't depend on
 * the proxy getting those headers right.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/") && MUTATING_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      const expected = process.env.APP_ORIGIN ?? req.nextUrl.origin;
      if (origin !== expected) {
        return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
