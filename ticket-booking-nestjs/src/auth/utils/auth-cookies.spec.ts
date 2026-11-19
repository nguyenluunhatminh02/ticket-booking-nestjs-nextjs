import {
  parseCookies,
  extractAccessToken,
  extractRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  decodeJwtExpMs,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from './auth-cookies';
import { Request, Response } from 'express';

describe('auth-cookies', () => {
  describe('parseCookies', () => {
    it('should parse multiple cookies', () => {
      const req = { headers: { cookie: 'a=1; b=2; c=hello%20world' } } as any;
      const result = parseCookies(req);
      expect(result).toEqual({ a: '1', b: '2', c: 'hello world' });
    });

    it('should return empty object for missing cookie header', () => {
      expect(parseCookies({ headers: {} } as any)).toEqual({});
    });
  });

  describe('extractAccessToken', () => {
    it('should prefer cookie over Authorization header', () => {
      const req = {
        headers: {
          cookie: `${ACCESS_COOKIE}=cookie-token`,
          authorization: 'Bearer header-token',
        },
      } as any;
      expect(extractAccessToken(req)).toBe('cookie-token');
    });

    it('should fall back to Bearer header', () => {
      const req = { headers: { authorization: 'Bearer header-token' } } as any;
      expect(extractAccessToken(req)).toBe('header-token');
    });

    it('should return null when neither present', () => {
      expect(extractAccessToken({ headers: {} } as any)).toBeNull();
    });
  });

  describe('extractRefreshToken', () => {
    it('should extract from cookie', () => {
      const req = { headers: { cookie: `${REFRESH_COOKIE}=refresh-abc` } } as any;
      expect(extractRefreshToken(req)).toBe('refresh-abc');
    });
  });

  describe('setAuthCookies / clearAuthCookies', () => {
    it('should set httpOnly cookies', () => {
      const res = { cookie: jest.fn(), clearCookie: jest.fn() } as any;
      setAuthCookies(res, 'at', 'rt', 900000, 604800000);
      expect(res.cookie).toHaveBeenCalledTimes(2);
      const [, , opts] = res.cookie.mock.calls[0];
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
    });

    it('should clear both cookies', () => {
      const res = { clearCookie: jest.fn() } as any;
      clearAuthCookies(res);
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('decodeJwtExpMs', () => {
    it('should extract exp from valid JWT', () => {
      const payload = { exp: 1700000000 };
      const token = `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
      expect(decodeJwtExpMs(token)).toBe(1700000000000);
    });

    it('should return null for invalid token', () => {
      expect(decodeJwtExpMs('garbage')).toBeNull();
    });
  });
});
