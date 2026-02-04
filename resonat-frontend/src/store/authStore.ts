// src/store/authStore.ts
import { create } from "zustand";
import type { User } from "../api/auth";

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (payload: { user: User; token: string }) => void;
  clearAuth: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,

  setAuth: ({ user, token }) =>
    set({
      user,
      token,
    }),

  clearAuth: () =>
    set({
      user: null,
      token: null,
    }),
    logout: () => set({ user: null, token: null }),
}));

