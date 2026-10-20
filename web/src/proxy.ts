import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, validSessionSecret, matchesSession, sessionAuthorized } from "@/lib/local-session.mjs";
import {
  checkRequest,
  parseAllowedHosts,
  parseAllowedOrigins,
} from "@/lib/origin-guard.mjs";

// Single choke point over pages, RSC payloads, assets and the API surface.
// Host/Origin are CSRF/rebinding checks, not client authentication. A fresh
// launcher-owned session secret protects private SSR content and API handlers.
// Every request passes the CSRF/Host guard before reaching a handler (which may
// spawn a child process or write the user's files). See origin-guard.mjs for
// the two-layer rationale (F1 drive-by CSRF, F2 LAN reachability).
//
// Extra Host aliases may be configured with CAREER_OPS_WEB_ALLOWED_HOSTS.
// They do not change the launcher's literal loopback listener.
//
// Opt in to extra *origins* the same way with CAREER_OPS_ALLOWED_ORIGINS;
// unset means none, which is the default and leaves the guard as strict as it
// was. It is what a local companion client needs: a browser extension calls
// from a chrome-extension:// origin, which Fetch Metadata always reports as
// "cross-site", so every one of its requests is refused otherwise.
export function proxy(req: NextRequest) {
  const decision = checkRequest({
    secFetchSite: req.headers.get("sec-fetch-site"),
    origin: req.headers.get("origin"),
    host: req.headers.get("host"),
    allowedHosts: parseAllowedHosts(process.env.CAREER_OPS_WEB_ALLOWED_HOSTS),
    allowedOrigins: parseAllowedOrigins(process.env.CAREER_OPS_ALLOWED_ORIGINS),
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.reason }, { status: decision.status });
  }
  const secret = process.env.CAREER_OPS_WEB_SESSION;
  if (!validSessionSecret(secret)) {
    return NextResponse.json({ error: "Start the private dashboard with npm run dev or npm start" }, { status: 503 });
  }
  if (req.nextUrl.pathname === "/_session") {
    if (req.method !== "GET" || !matchesSession(req.nextUrl.searchParams.get("token"), secret)) {
      return NextResponse.json({ error: "Invalid session link" }, { status: 401 });
    }
    const response = new NextResponse(null, { status: 303, headers: {
      Location: new URL("/", req.url).href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    } });
    response.cookies.set(SESSION_COOKIE, secret!, { httpOnly: true, sameSite: "strict", path: "/", secure: req.nextUrl.protocol === "https:" });
    return response;
  }
  if (!sessionAuthorized({ cookie: req.cookies.get(SESSION_COOKIE)?.value, authorization: req.headers.get("authorization"), secret })) {
    return NextResponse.json({ error: "Open the private session link printed in the server terminal" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = { matcher: "/:path*" };
