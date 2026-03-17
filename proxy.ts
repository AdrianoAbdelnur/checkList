import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/register"]);
const DEFAULT_AUTHENTICATED_REDIRECT = "/dashboard";

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("session")?.value;
  if (!token) return false;

  try {
    const verifyUrl = new URL("/api/auth/me", req.url);
    const res = await fetch(verifyUrl, {
      headers: {
        cookie: req.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const isLoggedIn = await hasValidSession(req);

  if (isPublicPath && isLoggedIn) {
    return NextResponse.redirect(new URL(DEFAULT_AUTHENTICATED_REDIRECT, req.url));
  }

  if (!isPublicPath && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    const nextPath = `${pathname}${search}`;

    if (nextPath !== "/") {
      loginUrl.searchParams.set("next", nextPath);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
