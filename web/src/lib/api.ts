import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getToken, removeToken } from './auth';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      removeToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  sendOtp: (phone: string) =>
    api.post('/auth/otp/send', { phone }),

  verifyOtp: (phone: string, otp: string) =>
    api.post<{
      success: boolean;
      data: {
        registered: boolean;
        access_token?: string;
        refresh_token?: string;
        user?: import('./auth').AuthUser;
      };
    }>('/auth/otp/verify', { phone, otp }),

  registerBuyer: (data: {
    phone: string;
    name: string;
    state: string;
    city: string;
    language_preference: string;
    otp_verified_phone: string;
  }) => api.post<{
    success: boolean;
    data: { access_token: string; refresh_token: string; user: import('./auth').AuthUser };
  }>('/auth/register/buyer', data),

  registerSeller: (data: {
    phone: string;
    name: string;
    business_name: string;
    business_type: 'manufacturer' | 'distributor' | 'retailer' | 'wholesaler';
    gst_number: string;
    bank_account_number: string;
    ifsc: string;
    language_preference: string;
    otp_verified_phone: string;
  }) => api.post<{ access_token: string; refresh_token: string; user: import('./auth').AuthUser }>(
    '/auth/register/seller', data
  ),
};

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryApi = {
  getListings: (params: {
    page?: number;
    limit?: number;
    sector?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
    sort_by?: string;
    featured?: boolean;
    seller_id?: string;
  }) => api.get<{ data: Listing[]; total: number; page: number; limit: number }>('/inventory/listings', { params }),

  getListing: (id: string) =>
    api.get<Listing>(`/inventory/listings/${id}`),

  getSectors: () =>
    api.get<Sector[]>('/inventory/sectors'),

  createListing: (data: {
    sector_id: string;
    title: string;
    description?: string;
    dead_stock_type: string;
    condition_grade: string;
    lot_type: string;
    total_quantity: number;
    moq?: number;
    unit: string;
    price_type: string;
    asking_price: number;
    floor_price?: number;
    mrp?: number;
    state: string;
    city: string;
    urgency_days?: number;
    images?: string[];
  }) => api.post<Listing>('/inventory/listings', data),

  updateListing: (id: string, data: Partial<{
    title: string;
    description: string;
    asking_price: number;
    floor_price: number;
    status: string;
    urgency_days: number;
  }>) => api.patch<Listing>(`/inventory/listings/${id}`, data),

  deleteListing: (id: string) =>
    api.delete(`/inventory/listings/${id}`),

  getMyListings: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<{ data: Listing[]; total: number }>('/inventory/listings/mine', { params }),

  addToWatchlist: (listingId: string) =>
    api.post(`/inventory/listings/${listingId}/watchlist`),

  getWatchlist: () =>
    api.get<Listing[]>('/inventory/watchlist'),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  placeOrder: (data: { listing_id: string; quantity: number; buyer_state: string }) =>
    api.post<Order>('/orders', data),

  getMyOrders: () =>
    api.get<Order[]>('/orders/my/buyer'),

  getSellerOrders: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ data: Order[]; total: number }>('/orders/my/seller', { params }),

  getOrder: (id: string) =>
    api.get<Order>(`/orders/${id}`),

  confirmDelivery: (id: string) =>
    api.patch(`/orders/${id}/confirm-delivery`),

  cancelOrder: (id: string, reason?: string) =>
    api.patch(`/orders/${id}/cancel`, { reason }),
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentApi = {
  initiate: (data: { orderId: string; amountPaisa: number; listingId: string; sellerId: string }) =>
    api.post<{ razorpay_order_id: string; key_id: string; amount: number }>('/payments/initiate', data),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  enhanceListing: (message: string, conversationHistory?: Array<{ role: string; content: string }>) =>
    api.post<{
      extracted_fields: Record<string, unknown>;
      missing_required: string[];
      questions: string[];
      confidence: number;
      detected_sector: string;
      conversational_response: string;
    }>('/ai/listing/prompt', {
      message,
      conversation_history: conversationHistory ?? [],
    }),

  suggestPrice: (data: {
    sector: string;
    condition_grade: string;
    dead_stock_type: string;
    quantity: number;
    mrp?: number;
  }) => api.post<{ recommended_price: number; floor_price: number; rationale: string }>(
    '/ai/pricing/recommend', data
  ),
};

// ── Shared types ──────────────────────────────────────────────────────────────
export interface Listing {
  id: string;
  title: string;
  description: string;
  asking_price: number;
  price_per_unit: number;
  total_quantity: number;
  available_quantity: number;
  quantity: number;
  unit: string;
  sector: string;
  sector_id: string;
  sector_name: string;
  seller_id: string;
  seller_business_name: string;
  seller_tier: string;
  seller_state: string;
  seller_city: string;
  state: string;
  city: string;
  gst_rate: number;
  images: string[];
  status: string;
  price_type: string;
  dead_stock_type: string;
  condition_grade: string;
  lot_type: string;
  moq: number;
  urgency_score: number;
  urgency_days: number;
  watchlist_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface Sector {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  listing_count?: number;
}

export interface Order {
  id: string;
  order_number: string;
  listing_id: string;
  listing_title: string;
  seller_id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_phone: string;
  quantity: number;
  price_per_unit: number;
  subtotal: number;
  gst_amount: number;
  freight_amount: number;
  total_amount: number;
  platform_fee: number;
  seller_payout: number;
  gst_rate: number;
  status: string;
  buyer_state: string;
  payment_status: string;
  escrow_status: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}
