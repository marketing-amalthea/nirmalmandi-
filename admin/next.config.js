/** @type {import('next').NextConfig} */
// Service URLs — set these as env vars in Vercel:
//   AUTH_SERVICE_URL      INVENTORY_SERVICE_URL  ORDER_SERVICE_URL
//   PAYMENT_SERVICE_URL   NOTIFICATION_SERVICE_URL  ANALYTICS_SERVICE_URL
//   AI_SERVICE_URL
const AUTH      = process.env.AUTH_SERVICE_URL         || 'https://nirmalmandiauth-service-production.up.railway.app';
const INVENTORY = process.env.INVENTORY_SERVICE_URL    || 'https://nirmalmandiinventory-service-production.up.railway.app';
const ORDER     = process.env.ORDER_SERVICE_URL        || 'https://nirmalmandiorder-service-production.up.railway.app';
const PAYMENT   = process.env.PAYMENT_SERVICE_URL      || 'https://nirmalmandipayment-service-production.up.railway.app';
const NOTIF     = process.env.NOTIFICATION_SERVICE_URL || 'https://nirmalmandinotification-service-production.up.railway.app';
const ANALYTICS = process.env.ANALYTICS_SERVICE_URL    || 'https://nirmalmandianalytics-service-production.up.railway.app';
const DISPUTE   = process.env.DISPUTE_SERVICE_URL      || 'https://nirmalmandidispute-service-production.up.railway.app';
const INVOICE   = process.env.INVOICE_SERVICE_URL      || 'https://nirmalmandiinvoice-service-production.up.railway.app';
const AI        = process.env.AI_SERVICE_URL           || 'https://nirmalmandiai-service-production.up.railway.app';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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

      // ── Dispute service ──────────────────────────────────────────────────
      { source: '/api/admin/disputes/:path*',        destination: `${DISPUTE}/admin/disputes/:path*` },
      { source: '/api/admin/disputes',               destination: `${DISPUTE}/admin/disputes` },

      // ── Invoice service ──────────────────────────────────────────────────
      { source: '/api/invoices/:path*',              destination: `${INVOICE}/invoices/:path*` },

      // ── Analytics — audit log lives here ────────────────────────────────
      { source: '/api/admin/audit-log/:path*',       destination: `${ANALYTICS}/admin/audit-log/:path*` },
      { source: '/api/admin/audit-log',              destination: `${ANALYTICS}/admin/audit-log` },

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
