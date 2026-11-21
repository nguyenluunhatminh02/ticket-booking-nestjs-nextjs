import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/verify-mfa", "/oauth2/redirect"];
const REFRESH_COOKIE = "refresh_token";
const ACCESS_COOKIE = "access_token";
const REFRESH_PATH = "/api/auth/refresh-token";
// SSRF fix: never derive the refresh target from the incoming request Host.
// Pin it to a trusted server-side origin; redirects are not followed.
const REFRESH_ORIGIN =
  process.env.INTERNAL_FRONTEND_ORIGIN || "http://127.0.0.1:3000";

function isAccessTokenExpired(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

async function refreshAccessToken(request: NextRequest): Promise<Response | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const headers = new Headers({ "content-type": "application/json" });
  headers.set("cookie", `${REFRESH_COOKIE}=${refreshToken}`);
  const deviceId = request.cookies.get("device_id")?.value;
  if (deviceId) headers.set("x-device-id", deviceId);

  try {
    const refreshUrl = new URL(REFRESH_PATH, REFRESH_ORIGIN);
    const response = await fetch(refreshUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(deviceId ? { deviceId } : {}),
      cache: "no-store",
      redirect: "manual",
    });
    if (!response.ok) return null;

    const setCookies = response.headers.getSetCookie?.() ?? [];
    const accessCookie = setCookies.find((c) => c.trim().startsWith(`${ACCESS_COOKIE}=`));
    if (!accessCookie) return null;

    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    try {
      const { payload } = await jwtVerify(accessCookie.split(";")[0].slice(ACCESS_COOKIE.length + 1), new TextEncoder().encode(secret));
      if (payload.type !== "ACCESS") return null;
    } catch {
      return null;
    }

    // Only trust Set-Cookie values issued by the backend refresh endpoint.
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete("cookie");
    for (const cookie of setCookies) {
      forwardHeaders.append("cookie", cookie.split(";")[0]);
    }

    const nextResponse = NextResponse.next({ request: { headers: forwardHeaders } });
    for (const cookie of setCookies) {
      nextResponse.headers.append("set-cookie", cookie);
    }
    return nextResponse;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/" ||
    PUBLIC_PATHS.some((p) => p !== "/" && pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const secret = process.env.JWT_SECRET;

  let valid = false;
  if (token && secret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
      valid = payload.type === "ACCESS";
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    // A stale access token is recoverable when the refresh cookie is present.
    // Refresh server-side before deciding to redirect; malformed/absent tokens
    // without a usable refresh session still go to login.
    if (isAccessTokenExpired(token) && request.cookies.has(REFRESH_COOKIE) && secret) {
      const refreshed = await refreshAccessToken(request);
      if (refreshed) return refreshed;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
