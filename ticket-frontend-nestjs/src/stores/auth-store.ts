import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserInfo } from "@/types/auth";
import apiClient from "@/lib/api-client";

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  mfaToken: string | null;

  setUser: (user: UserInfo) => void;
  setAuth: (user: UserInfo) => void;
  setMfaRequired: (mfaToken: string) => void;
  clearMfa: () => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      mfaRequired: false,
      mfaToken: null,

      setUser: (user) => set({ user, isAuthenticated: true }),

      setAuth: (user) =>
        set({ user, isAuthenticated: true, isLoading: false, mfaRequired: false, mfaToken: null }),

      setMfaRequired: (mfaToken) => set({ mfaRequired: true, mfaToken }),

      clearMfa: () => set({ mfaRequired: false, mfaToken: null }),

      logout: () => {
        set({ user: null, isAuthenticated: false, isLoading: false, mfaRequired: false, mfaToken: null });
      },

      setLoading: (isLoading) => set({ isLoading }),

      initialize: async () => {
        try {
          const res = await apiClient.get("/users/me");
          const u = res.data?.data;
          if (!u?.id) throw new Error("No session");
          set({
            user: {
              id: u.id,
              email: u.email,
              firstName: u.firstName,
              lastName: u.lastName,
              username: u.username,
              phoneNumber: u.phoneNumber,
              profilePicture: u.profilePicture,
              roles: u.roles ?? [],
              emailVerified: u.emailVerified,
              mfaEnabled: u.mfaEnabled,
              createdAt: u.createdAt,
              lastLoginAt: u.lastLoginAt,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        void state?.initialize();
      },
    }
  )
);
