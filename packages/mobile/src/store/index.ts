/**
 * Zustand global store for NirmalMandi mobile app.
 * Auth state, cart, notifications badge count.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthUser {
  userId: string;
  phone: string;
  role: 'buyer' | 'seller' | 'admin';
  fullName?: string;
  fcmToken?: string;
}

export interface CartItem {
  listingId: string;
  title: string;
  price: number;
  quantity: number;
  sellerName: string;
  imageUrl?: string;
}

interface AppStore {
  // Auth
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;

  // Cart
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (listingId: string) => void;
  clearCart: () => void;
  cartTotal: () => number;

  // Notifications
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  incrementUnread: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, cart: [] }),

      // Cart
      cart: [],
      addToCart: (item) => {
        const existing = get().cart.find(c => c.listingId === item.listingId);
        if (existing) {
          set(s => ({
            cart: s.cart.map(c =>
              c.listingId === item.listingId
                ? { ...c, quantity: c.quantity + item.quantity }
                : c
            ),
          }));
        } else {
          set(s => ({ cart: [...s.cart, item] }));
        }
      },
      removeFromCart: (listingId) =>
        set(s => ({ cart: s.cart.filter(c => c.listingId !== listingId) })),
      clearCart: () => set({ cart: [] }),
      cartTotal: () =>
        get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0),

      // Notifications
      unreadCount: 0,
      setUnreadCount: (n) => set({ unreadCount: n }),
      incrementUnread: () => set(s => ({ unreadCount: s.unreadCount + 1 })),
    }),
    {
      name: 'nm-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        cart: state.cart,
      }),
    }
  )
);
