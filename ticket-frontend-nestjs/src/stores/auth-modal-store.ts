import { create } from "zustand";

type AuthModalView = "login" | "register" | "forgot-password" | null;

interface AuthModalState {
  view: AuthModalView;
  isOpen: boolean;
  redirectTo: string | null;
  open: (view?: Exclude<AuthModalView, null>, redirectTo?: string | null) => void;
  close: () => void;
  switchView: (view: AuthModalView) => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  view: null,
  isOpen: false,
  redirectTo: null,
  open: (view = "login", redirectTo = null) =>
    set({ view, isOpen: true, redirectTo }),
  close: () => set({ view: null, isOpen: false, redirectTo: null }),
  switchView: (view) => set({ view }),
}));
