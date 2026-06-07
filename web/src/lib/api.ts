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
  placeOrder: (data: {
    listing_id: string;
    quantity: number;
    buyer_state?: string;
    delivery_address?: Address;
    freight_type?: string;
  }) => api.post<{ orderId: string; order_number: string }>('/orders', data),

  getMyOrders: (params?: { status?: string; page?: number; limit?: number; search?: string }) =>
    api.get<Order[]>('/orders/my/buyer', { params }),

  getSellerOrders: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ data: Order[]; total: number }>('/orders/my/seller', { params }),

  getOrder: (id: string) =>
    api.get<OrderDetail>(`/orders/${id}`),

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

export const paymentsApi = {
  initiatePayment: (orderId: string, amount: number) =>
    api.post<{ razorpay_order_id: string; razorpay_key: string; amount: number }>('/payments/initiate', {
      order_id: orderId,
      amount,
    }),
};

// ── Addresses ─────────────────────────────────────────────────────────────────
export const addressApi = {
  getAddresses: () =>
    api.get<Address[]>('/user/addresses'),

  addAddress: (data: {
    name: string;
    phone: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    pincode: string;
    save_for_future?: boolean;
  }) => api.post<Address>('/user/addresses', data),
};

// ── Disputes ──────────────────────────────────────────────────────────────────
export const disputeApi = {
  raiseDispute: (data: {
    order_id: string;
    reason: string;
    description: string;
    evidence_keys: string[];
  }) => api.post<{ id: string; status: string }>('/disputes/raise', data),

  getUploadUrl: (disputeId: string, filename: string, filetype: string) =>
    api.post<{ uploadUrl: string; key: string }>(`/disputes/${disputeId}/evidence`, {
      filename,
      filetype,
    }),
};

// ── Referral ──────────────────────────────────────────────────────────────────
export const referralApi = {
  getStats: () =>
    api.get<ReferralStats>('/referral/stats'),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  getNotifications: (params?: { page?: number; limit?: number; type?: string }) =>
    api.get<{ data: Notification[]; total: number }>('/notifications', { params }),

  markRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    api.patch('/notifications/read-all'),

  getUnreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count'),
};

// ── Invoices ──────────────────────────────────────────────────────────────────
export const invoiceApi = {
  getInvoice: (orderId: string) =>
    api.get<{ url: string }>(`/invoices/${orderId}`),
};

// ── Negotiations ─────────────────────────────────────────────────────────────
export const negotiationsApi = {
  makeOffer: (listing_id: string, offered_price: number, message?: string) =>
    api.post('/negotiations', { listing_id, offered_price, message }),

  counter: (id: string, offered_price: number, message?: string) =>
    api.post(`/negotiations/${id}/counter`, { offered_price, message }),

  accept: (id: string) =>
    api.post(`/negotiations/${id}/accept`),

  reject: (id: string) =>
    api.post(`/negotiations/${id}/reject`),

  getMyNegotiations: () =>
    api.get('/negotiations/my'),

  getForListing: (listing_id: string) =>
    api.get(`/negotiations/listing/${listing_id}`),
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

  generateCaption: (data: {
    listing_id: string;
    product_title: string;
    sector: string;
    price: number;
    mrp?: number;
    grade?: string;
    city: string;
    state: string;
    language: 'en' | 'hi' | 'hinglish';
    tone: 'urgent' | 'premium' | 'casual' | 'bulk';
    platform: 'instagram' | 'whatsapp' | 'facebook' | 'telegram';
  }) => api.post<{
    success: boolean;
    data: {
      hook: string;
      body: string;
      cta: string;
      hashtags: string[];
      full_caption: string;
      cost_credits: number;
    };
  }>('/ai/content/caption', data),

  generateHook: (data: {
    product_title: string;
    sector: string;
    discount_pct: number;
    language: 'en' | 'hi' | 'hinglish';
  }) => api.post<{ success: boolean; data: { hook: string } }>('/ai/content/hook', data),
};

// ── Logistics ─────────────────────────────────────────────────────────────────
export const logisticsApi = {
  getFreightEstimate: (params: {
    origin_pincode: string;
    dest_pincode: string;
    weight_kg: number;
    cod?: boolean;
    order_amount?: number;
  }) =>
    api.get<{
      success: boolean;
      data: { estimated_cost: number; estimated_days: number; provider: string; cod_available: boolean };
    }>('/logistics/freight/estimate', {
      params: {
        origin_pincode: params.origin_pincode,
        dest_pincode: params.dest_pincode,
        weight_kg: params.weight_kg,
        cod: params.cod ? 'true' : 'false',
        ...(params.order_amount ? { order_amount: params.order_amount } : {}),
      },
    }),
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
  type: 'order' | 'dispute' | 'listing' | 'system';
  is_read: boolean;
  created_at: string;
  data?: {
    link?: string;
    [key: string]: unknown;
  };
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderDetail extends Order {
  listing_images?: string[];
  listing_image?: string;
  seller_business_name: string;
  seller_name?: string;
  seller_city?: string;
  seller_state?: string;
  seller_response_rate?: number;
  delivery_address?: Address;
  freight_type?: string;
  awb_number?: string;
  carrier?: string;
  tracking_url?: string;
  confirmed_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  completed_at?: string;
  paid_at?: string;
  cancelled_at?: string;
  dispute_id?: string;
  unit?: string;
  condition_grade?: string;
  mrp?: number;
  commission_rate?: number;
  commission_amount?: number;
}

export interface ReferralStats {
  code: string;
  link: string;
  total_shares: number;
  clicks: number;
  conversions: number;
  total_earned: number;
  tier: 'silver' | 'gold' | 'platinum';
  referral_count: number;
  referrals: ReferralEntry[];
  payouts: ReferralPayout[];
}

export interface ReferralEntry {
  id: string;
  buyer_name: string;
  date: string;
  purchase_amount: number;
  commission: number;
  status: 'pending' | 'paid';
}

export interface ReferralPayout {
  id: string;
  date: string;
  amount: number;
  bank_last4: string;
  status: 'pending' | 'processing' | 'paid';
}
