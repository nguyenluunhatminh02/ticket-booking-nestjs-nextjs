import { describe, it, expect } from "vitest";
import type {
  ApiResponse,
  AuthResponse,
  UserInfo,
  LoginRequest,
  RegisterRequest,
  OAuth2Provider,
  ConnectedAccount,
  MfaVerifyRequest,
  DeviceResponse,
} from "@/types/auth";

describe("Auth Types", () => {
  describe("ApiResponse", () => {
    it("should allow success response with data", () => {
      const response: ApiResponse<string> = {
        success: true,
        message: "OK",
        data: "Hello",
      };
      expect(response.success).toBe(true);
      expect(response.data).toBe("Hello");
    });

    it("should allow error response", () => {
      const response: ApiResponse = {
        success: false,
        message: "Bad request",
        data: undefined as unknown,
      };
      expect(response.success).toBe(false);
    });
  });

  describe("AuthResponse", () => {
    it("should represent a successful auth response", () => {
      const user: UserInfo = {
        id: "123",
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
        roles: ["ROLE_USER"],
        emailVerified: true,
        mfaEnabled: false,
        createdAt: "2024-01-01",
      };

      const response: AuthResponse = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresIn: 900,
        user,
      };

      expect(response.accessToken).toBe("access-token");
      expect(response.tokenType).toBe("Bearer");
      expect(response.user.email).toBe("test@test.com");
    });

    it("should support MFA required response", () => {
      const response: AuthResponse = {
        accessToken: "",
        refreshToken: "",
        tokenType: "",
        expiresIn: 0,
        user: {} as UserInfo,
        mfaRequired: true,
        mfaToken: "mfa-token-123",
      };
      expect(response.mfaRequired).toBe(true);
      expect(response.mfaToken).toBe("mfa-token-123");
    });
  });

  describe("OAuth2Provider", () => {
    it("should correctly represent an OAuth2 provider", () => {
      const provider: OAuth2Provider = {
        name: "google",
        displayName: "Google",
        authUrl: "http://localhost:8080/oauth2/authorize/google",
        icon: "google",
      };
      expect(provider.name).toBe("google");
      expect(provider.authUrl).toContain("authorize/google");
    });

    it("should support all three providers", () => {
      const providers: OAuth2Provider[] = [
        { name: "google", displayName: "Google", authUrl: "/oauth2/authorize/google", icon: "google" },
        { name: "github", displayName: "GitHub", authUrl: "/oauth2/authorize/github", icon: "github" },
        { name: "microsoft", displayName: "Microsoft", authUrl: "/oauth2/authorize/microsoft", icon: "microsoft" },
      ];
      expect(providers).toHaveLength(3);
      expect(providers.map((p) => p.name)).toEqual(["google", "github", "microsoft"]);
    });
  });

  describe("ConnectedAccount", () => {
    it("should represent a connected OAuth account", () => {
      const account: ConnectedAccount = {
        id: "acc-123",
        provider: "github",
        email: "user@github.com",
        name: "GitHub User",
        imageUrl: "https://avatars.githubusercontent.com/u/123",
        connectedAt: "2024-01-15T10:30:00Z",
      };
      expect(account.provider).toBe("github");
      expect(account.imageUrl).toContain("avatars.githubusercontent.com");
    });

    it("should allow optional imageUrl", () => {
      const account: ConnectedAccount = {
        id: "acc-456",
        provider: "microsoft",
        email: "user@outlook.com",
        name: "MS User",
        connectedAt: "2024-01-15T10:30:00Z",
      };
      expect(account.imageUrl).toBeUndefined();
    });
  });

  describe("LoginRequest", () => {
    it("should represent a login request with optional fields", () => {
      const request: LoginRequest = {
        email: "user@example.com",
        password: "password123",
        deviceId: "device-abc",
        deviceName: "Chrome on Windows",
        deviceType: "WEB",
        rememberMe: true,
      };
      expect(request.email).toBe("user@example.com");
      expect(request.rememberMe).toBe(true);
    });
  });

  describe("RegisterRequest", () => {
    it("should represent a registration request", () => {
      const request: RegisterRequest = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      };
      expect(request.password).toBe(request.confirmPassword);
    });
  });

  describe("MfaVerifyRequest", () => {
    it("should represent an MFA verification request", () => {
      const request: MfaVerifyRequest = {
        mfaToken: "mfa-token-xyz",
        totpCode: "123456",
        deviceId: "device-123",
        deviceName: "Browser",
        deviceType: "WEB",
      };
      expect(request.totpCode).toHaveLength(6);
    });
  });

  describe("DeviceResponse", () => {
    it("should represent a device response", () => {
      const device: DeviceResponse = {
        id: "dev-1",
        deviceId: "device-abc",
        deviceName: "Chrome on Windows",
        deviceType: "WEB",
        browser: "Chrome 120",
        os: "Windows 11",
        ipAddress: "192.168.1.1",
        lastActiveAt: "2024-01-15T12:00:00Z",
        trusted: false,
        current: true,
        active: true,
      };
      expect(device.current).toBe(true);
      expect(device.active).toBe(true);
    });
  });
});
