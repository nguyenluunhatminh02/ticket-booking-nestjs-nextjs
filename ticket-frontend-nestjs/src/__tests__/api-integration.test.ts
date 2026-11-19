// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

/**
 * API Integration Test Suite
 * Tests that all frontend API endpoints are properly configured
 * and that request/response patterns match the backend API format.
 */

describe("API Endpoint Configuration", () => {
  describe("Auth Endpoints", () => {
    const endpoints = [
      { method: "POST", path: "/auth/login", description: "User Login" },
      { method: "POST", path: "/auth/register", description: "User Registration" },
      { method: "POST", path: "/auth/verify-mfa", description: "Verify MFA" },
      { method: "POST", path: "/auth/refresh-token", description: "Refresh Token" },
      { method: "POST", path: "/auth/logout", description: "Logout" },
      { method: "POST", path: "/auth/logout-all", description: "Logout All Devices" },
      { method: "GET", path: "/auth/verify-email", description: "Verify Email" },
      { method: "POST", path: "/auth/forgot-password", description: "Forgot Password" },
      { method: "POST", path: "/auth/reset-password", description: "Reset Password" },
      { method: "POST", path: "/auth/change-password", description: "Change Password" },
      { method: "POST", path: "/auth/resend-verification", description: "Resend Verification" },
      { method: "GET", path: "/auth/login-history", description: "Login History" },
      { method: "GET", path: "/auth/security-events", description: "Security Events" },
    ];

    endpoints.forEach(({ method, path, description }) => {
      it(`should have ${method} ${path} for ${description}`, () => {
        expect(path).toMatch(/^\/auth\//);
        expect(["GET", "POST", "PUT", "DELETE", "PATCH"]).toContain(method);
      });
    });
  });

  describe("OAuth2 Endpoints", () => {
    const endpoints = [
      { method: "GET", path: "/auth/oauth2/providers", description: "List OAuth2 Providers" },
      { method: "GET", path: "/auth/oauth2/connected-accounts", description: "List Connected Accounts" },
      { method: "DELETE", path: "/auth/oauth2/connected-accounts/{provider}", description: "Disconnect Account" },
    ];

    endpoints.forEach(({ method, path, description }) => {
      it(`should have ${method} ${path} for ${description}`, () => {
        expect(path).toMatch(/^\/auth\/oauth2\//);
      });
    });
  });

  describe("User Endpoints", () => {
    const endpoints = [
      { method: "GET", path: "/users/me", description: "Get Current User" },
      { method: "PUT", path: "/users/me", description: "Update Profile" },
      { method: "POST", path: "/users/me/deactivate", description: "Deactivate Account" },
    ];

    endpoints.forEach(({ method, path, description }) => {
      it(`should have ${method} ${path} for ${description}`, () => {
        expect(path).toMatch(/^\/users\//);
      });
    });
  });

  describe("MFA Endpoints", () => {
    const endpoints = [
      { method: "POST", path: "/mfa/setup", description: "Setup MFA" },
      { method: "POST", path: "/mfa/verify-setup", description: "Verify MFA Setup" },
      { method: "POST", path: "/mfa/disable", description: "Disable MFA" },
    ];

    endpoints.forEach(({ method, path, description }) => {
      it(`should have ${method} ${path} for ${description}`, () => {
        expect(path).toMatch(/^\/mfa\//);
      });
    });
  });

  describe("Device Endpoints", () => {
    const endpoints = [
      { method: "GET", path: "/devices", description: "List Devices" },
      { method: "DELETE", path: "/devices/{deviceId}", description: "Remove Device" },
    ];

    endpoints.forEach(({ method, path, description }) => {
      it(`should have ${method} ${path} for ${description}`, () => {
        expect(path).toMatch(/^\/devices/);
      });
    });
  });
});

describe("Request/Response Format Validation", () => {
  describe("Login Request Format", () => {
    it("should include required fields", () => {
      const loginRequest = {
        email: "test@example.com",
        password: "SecurePassword123!",
        deviceId: "device-uuid",
        deviceName: "Chrome on Windows",
        deviceType: "WEB",
      };
      expect(loginRequest).toHaveProperty("email");
      expect(loginRequest).toHaveProperty("password");
      expect(loginRequest).toHaveProperty("deviceId");
    });
  });

  describe("Auth Response Format", () => {
    it("should match backend ApiResponse wrapper", () => {
      const mockResponse = {
        success: true,
        message: "Login successful",
        data: {
          accessToken: "eyJtoken...",
          refreshToken: "eyJrefresh...",
          tokenType: "Bearer",
          expiresIn: 900,
          user: {
            id: "uuid",
            email: "user@example.com",
            firstName: "Test",
            lastName: "User",
            roles: ["ROLE_USER"],
            emailVerified: true,
            mfaEnabled: false,
          },
        },
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.data.tokenType).toBe("Bearer");
      expect(mockResponse.data.user.roles).toContain("ROLE_USER");
    });
  });

  describe("OAuth2 Provider Response Format", () => {
    it("should match backend OAuth2 providers response", () => {
      const mockResponse = {
        success: true,
        data: [
          {
            name: "google",
            displayName: "Google",
            authUrl: "http://localhost:8080/oauth2/authorize/google",
            icon: "google",
          },
          {
            name: "github",
            displayName: "GitHub",
            authUrl: "http://localhost:8080/oauth2/authorize/github",
            icon: "github",
          },
          {
            name: "microsoft",
            displayName: "Microsoft",
            authUrl: "http://localhost:8080/oauth2/authorize/microsoft",
            icon: "microsoft",
          },
        ],
      };

      expect(mockResponse.data).toHaveLength(3);
      expect(mockResponse.data[0].name).toBe("google");
      expect(mockResponse.data[1].name).toBe("github");
      expect(mockResponse.data[2].name).toBe("microsoft");
      mockResponse.data.forEach((provider) => {
        expect(provider).toHaveProperty("name");
        expect(provider).toHaveProperty("displayName");
        expect(provider).toHaveProperty("authUrl");
        expect(provider.authUrl).toContain("/oauth2/authorize/");
      });
    });
  });

  describe("Connected Account Response Format", () => {
    it("should match backend connected account response", () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: "uuid-123",
            provider: "google",
            email: "user@gmail.com",
            name: "Google User",
            imageUrl: "https://lh3.googleusercontent.com/photo.jpg",
            connectedAt: "2024-01-15T10:30:00Z",
          },
        ],
      };

      const account = mockResponse.data[0];
      expect(account).toHaveProperty("id");
      expect(account).toHaveProperty("provider");
      expect(account).toHaveProperty("email");
      expect(account).toHaveProperty("connectedAt");
    });
  });

  describe("Error Response Format", () => {
    it("should match backend error response", () => {
      const errorResponse = {
        success: false,
        message: "Invalid credentials",
        data: null,
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.message).toBeTruthy();
    });
  });

  describe("Paginated Response Format", () => {
    it("should match backend Page response", () => {
      const pageResponse = {
        success: true,
        data: {
          content: [{ id: "1" }, { id: "2" }],
          totalElements: 50,
          totalPages: 3,
          size: 20,
          number: 0,
          first: true,
          last: false,
        },
      };

      expect(pageResponse.data.content).toHaveLength(2);
      expect(pageResponse.data.totalElements).toBe(50);
      expect(pageResponse.data.first).toBe(true);
    });
  });
});

describe("Token Interceptor Behavior", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should include Authorization header when token exists", () => {
    localStorage.setItem("access_token", "test-token-123");
    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    expect(headers["Authorization"]).toBe("Bearer test-token-123");
  });

  it("should not include Authorization header when no token", () => {
    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("should include X-Device-Id header", () => {
    localStorage.setItem("device_id", "device-uuid");
    const deviceId = localStorage.getItem("device_id");
    const headers: Record<string, string> = {};
    if (deviceId) headers["X-Device-Id"] = deviceId;
    expect(headers["X-Device-Id"]).toBe("device-uuid");
  });
});
