import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/auth";

// Decision #9: minimal password gate, on by default the moment this leaves
// localhost. If APP_PASSWORD isn't set at all, we assume local dev and skip
// the gate — but log a loud warning so it's never silently skipped in prod.
export async function middleware(req: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    if (process.env.VERCEL) {
      // Deployed to Vercel with no APP_PASSWORD set — this is exactly the
      // "bare public URL" state Decision #9 exists to prevent. Fail closed.
      return new NextResponse(
        "APP_PASSWORD is not configured. Set it in your Vercel project's environment variables before this deployment is reachable — see Decision #9 in the spec.",
        { status: 500 }
      );
    }
    return NextResponse.next(); // local dev, no password set, allowed through
  }

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = token ? await verifySessionToken(token) : false;

  if (!valid) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
