import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('nm_admin_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nm_admin_token');
        localStorage.removeItem('nm_admin_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  sendOtp: (phone: string) =>
    api.post('/auth/admin/otp/send', { phone }),
  verifyOtp: (phone: string, otp: string) =>
    api.post('/auth/admin/otp/verify', { phone, otp }),
  logout: () =>
    api.post('/auth/admin/logout'),
};

export const statsApi = {
  getDashboard: () =>
    api.get('/admin/stats/dashboard'),
  getGmvHistory: (days: number = 30) =>
    api.get(`/admin/stats/gmv?days=${days}`),
  getAlerts: () =>
    api.get('/admin/stats/alerts'),
  getRecentTransactions: () =>
    api.get('/admin/stats/recent-transactions'),
};

export const inventoryApi = {
  getListings: (params: Record<string, string | number>) =>
    api.get('/admin/inventory', { params }),
  featureListing: (id: string) =>
    api.patch(`/admin/inventory/${id}/feature`),
  unfeatureListing: (id: string) =>
    api.patch(`/admin/inventory/${id}/unfeature`),
  pauseListing: (id: string) =>
    api.patch(`/admin/inventory/${id}/pause`),
  delistListing: (id: string) =>
    api.patch(`/admin/inventory/${id}/delist`),
  bulkAction: (ids: string[], action: string, payload?: Record<string, unknown>) =>
    api.post('/admin/inventory/bulk', { ids, action, ...payload }),
  getListing: (id: string) =>
    api.get(`/admin/inventory/${id}`),
};

export const transactionsApi = {
  getOrders: (params: Record<string, string | number>) =>
    api.get('/admin/transactions', { params }),
  getOrder: (id: string) =>
    api.get(`/admin/transactions/${id}`),
  freezeEscrow: (id: string) =>
    api.patch(`/admin/transactions/${id}/escrow/freeze`),
  releaseEscrow: (id: string) =>
    api.patch(`/admin/transactions/${id}/escrow/release`),
};

export const disputesApi = {
  getDisputes: (params?: Record<string, string | number>) =>
    api.get('/admin/disputes', { params }),
  getDispute: (id: string) =>
    api.get(`/admin/disputes/${id}`),
  resolveDispute: (id: string, data: { resolution: string; notes: string; winningSide: string }) =>
    api.post(`/admin/disputes/${id}/resolve`, data),
  getEvidence: (id: string) =>
    api.get(`/admin/disputes/${id}/evidence`),
};

export const usersApi = {
  getUsers: (params: Record<string, string | number>) =>
    api.get('/admin/users', { params }),
  getUser: (id: string) =>
    api.get(`/admin/users/${id}`),
  activateUser: (id: string) =>
    api.patch(`/admin/users/${id}/activate`),
  suspendUser: (id: string, reason: string) =>
    api.patch(`/admin/users/${id}/suspend`, { reason }),
  banUser: (id: string, reason: string) =>
    api.patch(`/admin/users/${id}/ban`, { reason }),
  getKycDocs: (id: string) =>
    api.get(`/admin/users/${id}/kyc`),
  reviewKycDoc: (userId: string, docId: string, status: 'approved' | 'rejected', note?: string) =>
    api.patch(`/admin/users/${userId}/kyc/${docId}`, { status, note }),
};

export const categoriesApi = {
  getCategories: () =>
    api.get('/admin/categories'),
  createCategory: (data: {
    name: string; slug: string; commission_rate?: number; gst_rate?: number;
  }) =>
    api.post('/admin/categories', data),
  updateCategory: (id: string, data: {
    name?: string; slug?: string; commission_rate?: number; gst_rate?: number; admin_approved?: boolean;
  }) =>
    api.patch(`/admin/categories/${id}`, data),
  toggleCategory: (id: string) =>
    api.patch(`/admin/categories/${id}/toggle`),
};

export const adminAnalyticsApi = {
  getInventoryHeatmap: () =>
    api.get('/admin/stats/inventory-heatmap'),
  getDemandSupply: () =>
    api.get('/admin/stats/demand-supply'),
  getSellerScorecard: (limit = 20) =>
    api.get(`/admin/stats/seller-scorecard?limit=${limit}`),
};

export const settingsApi = {
  getSettings: () =>
    api.get('/admin/settings'),
  updateSettings: (data: Record<string, string>) =>
    api.patch('/admin/settings', data),
};

export const notificationsAdminApi = {
  getLogs: (params?: Record<string, string | number>) =>
    api.get('/admin/notifications/logs', { params }),
  broadcast: (data: {
    title: string; message: string; channel?: string; targetRole?: string;
  }) =>
    api.post('/admin/notifications/broadcast', data),
  sendToUser: (data: {
    user_id: string; title: string; body: string; channel: string;
  }) =>
    api.post('/admin/notifications/send-to-user', data),
};

export const kycAdminApi = {
  getList: (params: Record<string, string | number>) =>
    api.get('/admin/kyc', { params }),
  getStats: () =>
    api.get('/admin/kyc/stats'),
  getPendingCount: () =>
    api.get('/admin/kyc/pending-count'),
  review: (id: string, body: Record<string, string>) =>
    api.post(`/admin/kyc/${id}/review`, body),
};

export const payoutsAdminApi = {
  getPayouts: (params: Record<string, string | number>) =>
    api.get('/admin/payouts', { params }),
  getStats: () =>
    api.get('/admin/payouts/stats'),
  approve: (id: string) =>
    api.post(`/admin/payouts/${id}/approve`),
  hold: (id: string, reason: string) =>
    api.post(`/admin/payouts/${id}/hold`, { reason }),
  release: (id: string) =>
    api.post(`/admin/payouts/${id}/release`),
  process: (id: string) =>
    api.post(`/admin/payouts/${id}/process`),
  bulkApprove: (ids: string[]) =>
    api.post('/admin/payouts/bulk-approve', { ids }),
  bulkHold: (ids: string[], reason: string) =>
    api.post('/admin/payouts/bulk-hold', { ids, reason }),
};

export const auditLogApi = {
  getLog: (params: Record<string, string | number>) =>
    api.get('/admin/audit-log', { params }),
  getAdmins: () =>
    api.get('/admin/audit-log/admins'),
  exportCsv: (params: Record<string, string>) =>
    api.get('/admin/audit-log/export-csv', { params, responseType: 'blob' }),
};

export const referralsApi = {
  getReferrals: (params: Record<string, string | number>) =>
    api.get('/admin/referrals', { params }),
};
