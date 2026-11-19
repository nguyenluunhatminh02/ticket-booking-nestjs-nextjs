import { describe, it, expect } from "vitest";
import { decodeToken } from "@/lib/auth";

describe("OAuth2 Redirect Flow", () => {
  describe("Token Decoding", () => {
    it("should decode JWT to extract user info", () => {
      const payload = {
        sub: "user-uuid-123",
        email: "oauth@example.com",
        firstName: "OAuth",
        lastName: "User",
        roles: ["ROLE_USER"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const encoded = btoa(JSON.stringify(payload));
      const token = `header.${encoded}.signature`;

      const decoded = decodeToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.sub).toBe("user-uuid-123");
      expect(decoded!.email).toBe("oauth@example.com");
      expect(decoded!.roles).toEqual(["ROLE_USER"]);
    });

    it("should handle missing email in token payload", () => {
      const payload = { sub: "user-uuid" };
      const encoded = btoa(JSON.stringify(payload));
      const token = `header.${encoded}.signature`;

      const decoded = decodeToken(token);
      expect(decoded!.email).toBeUndefined();
    });

    it("should return null for malformed token", () => {
      expect(decodeToken("not-a-token")).toBeNull();
      expect(decodeToken("")).toBeNull();
    });
  });

  describe("Query Parameter Parsing", () => {
    it("should handle error query param from OAuth2 failure", () => {
      const errorMessage = "Email not found from OAuth2 provider";
      const params = new URLSearchParams({ error: errorMessage });

      expect(params.get("error")).toBe(errorMessage);
    });

    it("should handle URL-encoded error messages", () => {
      const errorMessage = "Email not found from OAuth2 provider";
      const params = new URLSearchParams({ error: encodeURIComponent(errorMessage) });

      const decoded = decodeURIComponent(params.get("error")!);
      expect(decoded).toBe(errorMessage);
    });

    it("should detect absence of error param as success", () => {
      const params = new URLSearchParams({});
      expect(params.get("error")).toBeNull();
    });
  });
});
