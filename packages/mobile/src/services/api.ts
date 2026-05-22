/**
 * Axios API client for NirmalMandi mobile app.
 * Injects auth token from store.
 * Auto-refreshes on 401.
 */
import axios, { AxiosInstance } from 'axios';
import { useAppStore } from '../store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.nirmalmandi.com';

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach token
api.interceptors.request.use(config => {
  const token = useAppStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — auto refresh on 401
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = useAppStore.getState().refreshToken;
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = res.data.data;
        const user = useAppStore.getState().user!;
        useAppStore.getState().setAuth(user, accessToken, newRefresh);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        useAppStore.getState().clearAuth();
      }
    }
    return Promise.reject(err);
  }
);

// Service-specific helpers
export const authApi = {
  sendOtp: (phone: string) => api.post('/auth/otp/send', { phone }),
  verifyOtp: (phone: string, otp: string) => api.post('/auth/otp/verify', { phone, otp }),
  registerBuyer: (data: object) => api.post('/auth/register/buyer', data),
  registerSeller: (data: object) => api.post('/auth/register/seller', data),
  refresh: (token: string) => api.post('/auth/refresh', { refreshToken: token }),
};

export const listingsApi = {
  search: (params: object) => api.get('/search', { params }),
  getDeals: (params?: object) => api.get('/search/deals', { params }),
  getById: (id: string) => api.get(`/inventory/listings/${id}`),
  create: (data: object) => api.post('/inventory/listings', data),
  update: (id: string, data: object) => api.patch(`/inventory/listings/${id}`, data),
  addToWatchlist: (id: string) => api.post(`/inventory/listings/${id}/watchlist`),
};

export const ordersApi = {
  create: (data: object) => api.post('/orders', data),
  getMyOrders: (params?: object) => api.get('/orders/my', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  confirmDelivery: (orderId: string) => api.post('/payments/confirm-delivery', { orderId }),
};

export const aiApi = {
  listingPrompt: (data: object) => api.post('/ai/listing/prompt', data),
  generateCaption: (data: object) => api.post('/ai/content/caption', data),
  agentChat: (data: object) => api.post('/ai/agent/chat', data),
  getPricingSuggestion: (listingId: string) => api.get(`/ai/pricing/${listingId}`),
};
