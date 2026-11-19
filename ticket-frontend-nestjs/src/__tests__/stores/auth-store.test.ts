import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import type { UserInfo } from "@/types/auth";

describe("Auth Store", () => {
  const mockUser: UserInfo = {
    id: "user-123",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    roles: ["ROLE_USER"],
    emailVerified: true,
    mfaEnabled: false,
    createdAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      mfaRequired: false,
      mfaToken: null,
    });
    localStorage.clear();
  });

  describe("setAuth", () => {
    it("should set user and authentication state", () => {
      const { setAuth } = useAuthStore.getState();
      setAuth(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.mfaRequired).toBe(false);
      expect(state.mfaToken).toBeNull();
    });
  });

  describe("setMfaRequired", () => {
    it("should set MFA required state with token", () => {
      const { setMfaRequired } = useAuthStore.getState();
      setMfaRequired("mfa-token-abc");

      const state = useAuthStore.getState();
      expect(state.mfaRequired).toBe(true);
      expect(state.mfaToken).toBe("mfa-token-abc");
    });
  });

  describe("clearMfa", () => {
    it("should clear MFA state", () => {
      const { setMfaRequired, clearMfa } = useAuthStore.getState();
      setMfaRequired("mfa-token");
      clearMfa();

      const state = useAuthStore.getState();
      expect(state.mfaRequired).toBe(false);
      expect(state.mfaToken).toBeNull();
    });
  });

  describe("logout", () => {
    it("should clear all auth state", () => {
      const { setAuth, logout } = useAuthStore.getState();
      setAuth(mockUser);
      logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.mfaRequired).toBe(false);
    });
  });

  describe("setLoading", () => {
    it("should update loading state", () => {
      const { setLoading } = useAuthStore.getState();
      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);

      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });
});
