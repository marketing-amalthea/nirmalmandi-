/** @type {import('next').NextConfig} */
// Correct port map (matches .env):
// auth=3001 | inventory=3002 | order=3003 | search=3004
// payment=3005 | notification=3006 | logistics=3007 | analytics=3008
// invoice=3009 | dispute=3010 | ai=8000
const nextConfig = {
  async rewrites() {
    return [
      // ── Auth service (3001) ──────────────────────────────────────────────
      { source: '/api/auth/:path*',                  destination: 'http://localhost:3001/auth/:path*' },
      { source: '/api/admin/users/:path*',           destination: 'http://localhost:3001/admin/users/:path*' },
      { source: '/api/admin/users',                  destination: 'http://localhost:3001/admin/users' },
      { source: '/api/admin/kyc/:path*',             destination: 'http://localhost:3001/admin/kyc/:path*' },
      { source: '/api/admin/kyc',                    destination: 'http://localhost:3001/admin/kyc' },
      { source: '/api/admin/referrals/:path*',       destination: 'http://localhost:3001/admin/referrals/:path*' },
      { source: '/api/admin/referrals',              destination: 'http://localhost:3001/admin/referrals' },

      // ── Inventory service (3002) ─────────────────────────────────────────
      { source: '/api/admin/inventory/:path*',       destination: 'http://localhost:3002/admin/inventory/:path*' },
      { source: '/api/admin/inventory',              destination: 'http://localhost:3002/admin/inventory' },
      { source: '/api/admin/categories/:path*',      destination: 'http://localhost:3002/admin/categories/:path*' },
      { source: '/api/admin/categories',             destination: 'http://localhost:3002/admin/categories' },

      // ── Order service (3003) ─────────────────────────────────────────────
      { source: '/api/admin/transactions/:path*',    destination: 'http://localhost:3003/admin/transactions/:path*' },
      { source: '/api/admin/transactions',           destination: 'http://localhost:3003/admin/transactions' },
      { source: '/api/admin/disputes/:path*',        destination: 'http://localhost:3003/admin/disputes/:path*' },
      { source: '/api/admin/disputes',               destination: 'http://localhost:3003/admin/disputes' },
      { source: '/api/admin/audit-log/:path*',       destination: 'http://localhost:3003/admin/audit-log/:path*' },
      { source: '/api/admin/audit-log',              destination: 'http://localhost:3003/admin/audit-log' },

      // ── Payment service (3005 — fixed from 3004) ─────────────────────────
      { source: '/api/admin/payouts/:path*',         destination: 'http://localhost:3005/admin/payouts/:path*' },
      { source: '/api/admin/payouts',                destination: 'http://localhost:3005/admin/payouts' },
      { source: '/api/payments/:path*',              destination: 'http://localhost:3005/payments/:path*' },

      // ── Notification service (3006 — fixed from 3005) ────────────────────
      { source: '/api/admin/notifications/:path*',   destination: 'http://localhost:3006/admin/notifications/:path*' },
      { source: '/api/admin/notifications',          destination: 'http://localhost:3006/admin/notifications' },

      // ── Analytics service (3008) ─────────────────────────────────────────
      { source: '/api/admin/stats/:path*',           destination: 'http://localhost:3008/admin/stats/:path*' },
      { source: '/api/admin/stats',                  destination: 'http://localhost:3008/admin/stats' },
      { source: '/api/admin/settings/:path*',        destination: 'http://localhost:3008/admin/settings/:path*' },
      { source: '/api/admin/settings',               destination: 'http://localhost:3008/admin/settings' },
      { source: '/api/analytics/:path*',             destination: 'http://localhost:3008/analytics/:path*' },

      // ── AI service (8000) ────────────────────────────────────────────────
      { source: '/api/ai/:path*',                    destination: 'http://localhost:8000/:path*' },
    ];
  },

  images: {
    domains: [
      'storage.googleapis.com',
      'cdn.nirmalmandi.com',
      'nirmalmandi-assets.s3.ap-south-1.amazonaws.com',
    ],
  },
};

module.exports = nextConfig;
