import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: 'buyer' | 'seller' | 'admin';
  profile_id: string;
}

export type Language = 'en' | 'hi';

interface AuthState {
  user: AuthUser | null;
  access_token: string | null;
  refresh_token: string | null;
  language: Language;
  isAuthenticated: boolean;
}

interface AuthActions {
  setAuth: (
    user: AuthUser,
    access_token: string,
    refresh_token: string
  ) => void;
  logout: () => void;
  setLanguage: (lang: Language) => void;
}

type AuthStore = AuthState & AuthActions;

// ── SecureStore adapter for Zustand persist ───────────────────────────────────

const secureStoreStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silently fail on storage errors — auth will be lost on next cold start
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silently ignore
    }
  },
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // State
      user: null,
      access_token: null,
      refresh_token: null,
      language: 'en',
      isAuthenticated: false,

      // Actions
      setAuth: (user, access_token, refresh_token) =>
        set({
          user,
          access_token,
          refresh_token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          access_token: null,
          refresh_token: null,
          isAuthenticated: false,
        }),

      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'nm-auth',
      storage: createJSONStorage(() => secureStoreStorage),
      // Only persist what needs to survive restarts
      partialize: (state) => ({
        user: state.user,
        access_token: state.access_token,
        refresh_token: state.refresh_token,
        language: state.language,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
