import type { NextResponse } from "next/server";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSessionCookieOptions(maxAge: number) {
  return {
    name: "session",
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set({
    ...getSessionCookieOptions(SESSION_MAX_AGE_SECONDS),
    value: token,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    ...getSessionCookieOptions(0),
    value: "",
  });
}
