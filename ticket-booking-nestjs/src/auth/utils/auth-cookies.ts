import { Request, Response } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers?.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function extractAccessToken(req: Request): string | null {
  const cookies = parseCookies(req);
  if (cookies[ACCESS_COOKIE]) return cookies[ACCESS_COOKIE];
  const auth = req.headers?.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function extractRefreshToken(req: Request): string | null {
  return parseCookies(req)[REFRESH_COOKIE] ?? null;
}

function baseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  accessTtlMs: number,
  refreshTtlMs: number,
): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions(), maxAge: accessTtlMs });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookieOptions(), maxAge: refreshTtlMs });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions());
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
}

export function decodeJwtExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
