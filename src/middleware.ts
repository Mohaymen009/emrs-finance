import { NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defense-in-depth CSRF guard for the API surface.
 *
 * The primary CSRF defense is the session cookie itself (httpOnly,
 * SameSite=Lax — browsers do not attach it to cross-site POST/PUT/PATCH/
 * DELETE requests). This middleware adds a second, independent check: for
 * every mutating request to /api/*, if an Origin header is present, it must
 * match this deployment's own origin. Requests that omit Origin entirely
 * (some non-browser clients, or older browsers on some requests) are not
 * blocked here since the cookie policy already covers them — this check
 * exists to catch cases where SameSite enforcement might be bypassed
 * (e.g. a misconfigured proxy stripping cookie attributes).
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/") && MUTATING_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      const expected = req.nextUrl.origin;
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
