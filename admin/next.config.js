/** @type {import('next').NextConfig} */
// Service URLs — set these as env vars in Vercel:
//   AUTH_SERVICE_URL      INVENTORY_SERVICE_URL  ORDER_SERVICE_URL
//   PAYMENT_SERVICE_URL   NOTIFICATION_SERVICE_URL  ANALYTICS_SERVICE_URL
//   AI_SERVICE_URL
const AUTH      = process.env.AUTH_SERVICE_URL         || 'http://localhost:3001';
const INVENTORY = process.env.INVENTORY_SERVICE_URL    || 'http://localhost:3002';
const ORDER     = process.env.ORDER_SERVICE_URL        || 'http://localhost:3003';
const PAYMENT   = process.env.PAYMENT_SERVICE_URL      || 'http://localhost:3005';
const NOTIF     = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006';
const ANALYTICS = process.env.ANALYTICS_SERVICE_URL    || 'http://localhost:3008';
const AI        = process.env.AI_SERVICE_URL           || 'http://localhost:8000';

const nextConfig = {
  async rewrites() {
    return [
      // ── Auth service ─────────────────────────────────────────────────────
      { source: '/api/auth/:path*',                  destination: `${AUTH}/auth/:path*` },
      { source: '/api/admin/users/:path*',           destination: `${AUTH}/admin/users/:path*` },
      { source: '/api/admin/users',                  destination: `${AUTH}/admin/users` },
      { source: '/api/admin/kyc/:path*',             destination: `${AUTH}/admin/kyc/:path*` },
      { source: '/api/admin/kyc',                    destination: `${AUTH}/admin/kyc` },
      { source: '/api/admin/referrals/:path*',       destination: `${AUTH}/admin/referrals/:path*` },
      { source: '/api/admin/referrals',              destination: `${AUTH}/admin/referrals` },

      // ── Inventory service ────────────────────────────────────────────────
      { source: '/api/admin/inventory/:path*',       destination: `${INVENTORY}/admin/inventory/:path*` },
      { source: '/api/admin/inventory',              destination: `${INVENTORY}/admin/inventory` },
      { source: '/api/admin/categories/:path*',      destination: `${INVENTORY}/admin/categories/:path*` },
      { source: '/api/admin/categories',             destination: `${INVENTORY}/admin/categories` },

      // ── Order service ────────────────────────────────────────────────────
      { source: '/api/admin/transactions/:path*',    destination: `${ORDER}/admin/transactions/:path*` },
      { source: '/api/admin/transactions',           destination: `${ORDER}/admin/transactions` },
      { source: '/api/admin/disputes/:path*',        destination: `${ORDER}/admin/disputes/:path*` },
      { source: '/api/admin/disputes',               destination: `${ORDER}/admin/disputes` },
      { source: '/api/admin/audit-log/:path*',       destination: `${ORDER}/admin/audit-log/:path*` },
      { source: '/api/admin/audit-log',              destination: `${ORDER}/admin/audit-log` },

      // ── Payment service ──────────────────────────────────────────────────
      { source: '/api/admin/payouts/:path*',         destination: `${PAYMENT}/admin/payouts/:path*` },
      { source: '/api/admin/payouts',                destination: `${PAYMENT}/admin/payouts` },
      { source: '/api/payments/:path*',              destination: `${PAYMENT}/payments/:path*` },

      // ── Notification service ─────────────────────────────────────────────
      { source: '/api/admin/notifications/:path*',   destination: `${NOTIF}/admin/notifications/:path*` },
      { source: '/api/admin/notifications',          destination: `${NOTIF}/admin/notifications` },

      // ── Analytics service ────────────────────────────────────────────────
      { source: '/api/admin/stats/:path*',           destination: `${ANALYTICS}/admin/stats/:path*` },
      { source: '/api/admin/stats',                  destination: `${ANALYTICS}/admin/stats` },
      { source: '/api/admin/settings/:path*',        destination: `${ANALYTICS}/admin/settings/:path*` },
      { source: '/api/admin/settings',               destination: `${ANALYTICS}/admin/settings` },
      { source: '/api/analytics/:path*',             destination: `${ANALYTICS}/analytics/:path*` },

      // ── AI service ───────────────────────────────────────────────────────
      { source: '/api/ai/:path*',                    destination: `${AI}/:path*` },
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
