/** @type {import('next').NextConfig} */
// Service URLs — set these as env vars in Vercel:
//   AUTH_SERVICE_URL      INVENTORY_SERVICE_URL  ORDER_SERVICE_URL
//   SEARCH_SERVICE_URL    PAYMENT_SERVICE_URL    NOTIFICATION_SERVICE_URL
//   LOGISTICS_SERVICE_URL ANALYTICS_SERVICE_URL  INVOICE_SERVICE_URL
//   DISPUTE_SERVICE_URL   AI_SERVICE_URL
const AUTH       = process.env.AUTH_SERVICE_URL        || 'http://localhost:3001';
const INVENTORY  = process.env.INVENTORY_SERVICE_URL   || 'http://localhost:3002';
const ORDER      = process.env.ORDER_SERVICE_URL       || 'http://localhost:3003';
const SEARCH     = process.env.SEARCH_SERVICE_URL      || 'http://localhost:3004';
const PAYMENT    = process.env.PAYMENT_SERVICE_URL     || 'http://localhost:3005';
const NOTIF      = process.env.NOTIFICATION_SERVICE_URL|| 'http://localhost:3006';
const LOGISTICS  = process.env.LOGISTICS_SERVICE_URL   || 'http://localhost:3007';
const ANALYTICS  = process.env.ANALYTICS_SERVICE_URL   || 'http://localhost:3008';
const INVOICE    = process.env.INVOICE_SERVICE_URL     || 'http://localhost:3009';
const DISPUTE    = process.env.DISPUTE_SERVICE_URL     || 'http://localhost:3010';
const AI         = process.env.AI_SERVICE_URL          || 'http://localhost:8000';

module.exports = {
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  async rewrites() {
    return [
      // ── Auth service ─────────────────────────────────────────────────────
      { source: '/api/auth/:path*',              destination: `${AUTH}/auth/:path*` },
      { source: '/api/profile/:path*',           destination: `${AUTH}/profile/:path*` },
      { source: '/api/user/addresses',           destination: `${AUTH}/profile/addresses` },
      { source: '/api/user/addresses/:path*',    destination: `${AUTH}/profile/addresses/:path*` },
      { source: '/api/referral/stats',           destination: `${AUTH}/profile/referral` },
      { source: '/api/referral/:path*',          destination: `${AUTH}/profile/referral/:path*` },

      // ── Inventory service ────────────────────────────────────────────────
      { source: '/api/inventory/listings/:path*',  destination: `${INVENTORY}/listings/:path*` },
      { source: '/api/inventory/listings',         destination: `${INVENTORY}/listings` },
      { source: '/api/inventory/sectors/:path*',   destination: `${INVENTORY}/sectors/:path*` },
      { source: '/api/inventory/sectors',          destination: `${INVENTORY}/sectors` },
      { source: '/api/inventory/images/:path*',    destination: `${INVENTORY}/images/:path*` },
      { source: '/api/seller/listings/:path*',     destination: `${INVENTORY}/seller/listings/:path*` },
      { source: '/api/seller/listings',            destination: `${INVENTORY}/seller/listings` },
      { source: '/api/buyer/watchlist',            destination: `${INVENTORY}/buyer/watchlist` },
      { source: '/api/buyer/:path*',               destination: `${INVENTORY}/buyer/:path*` },

      // ── Order service ────────────────────────────────────────────────────
      { source: '/api/orders/:path*',              destination: `${ORDER}/orders/:path*` },
      { source: '/api/orders',                     destination: `${ORDER}/orders` },
      { source: '/api/cart/:path*',                destination: `${ORDER}/cart/:path*` },
      { source: '/api/cart',                       destination: `${ORDER}/cart` },
      { source: '/api/negotiations/:path*',        destination: `${ORDER}/negotiations/:path*` },
      { source: '/api/negotiations',               destination: `${ORDER}/negotiations` },

      // ── Search service ───────────────────────────────────────────────────
      { source: '/api/search/:path*',              destination: `${SEARCH}/search/:path*` },

      // ── Payment service ──────────────────────────────────────────────────
      { source: '/api/payments/:path*',            destination: `${PAYMENT}/payments/:path*` },
      { source: '/api/payments',                   destination: `${PAYMENT}/payments` },

      // ── Notification service ─────────────────────────────────────────────
      { source: '/api/notifications/:path*',       destination: `${NOTIF}/notifications/:path*` },
      { source: '/api/notifications',              destination: `${NOTIF}/notifications` },

      // ── Logistics service ────────────────────────────────────────────────
      { source: '/api/logistics/freight/:path*',   destination: `${LOGISTICS}/freight/:path*` },
      { source: '/api/logistics/shipments/:path*', destination: `${LOGISTICS}/shipments/:path*` },

      // ── Analytics service ────────────────────────────────────────────────
      { source: '/api/seller/dashboard',                        destination: `${ANALYTICS}/seller/dashboard` },
      { source: '/api/seller/analytics',                        destination: `${ANALYTICS}/seller/analytics` },
      { source: '/api/seller/listings/:id/performance',         destination: `${ANALYTICS}/seller/listings/:id/performance` },
      { source: '/api/seller/:path*',                           destination: `${ANALYTICS}/seller/:path*` },
      { source: '/api/analytics/:path*',           destination: `${ANALYTICS}/analytics/:path*` },

      // ── Invoice service ──────────────────────────────────────────────────
      { source: '/api/invoices/:path*',            destination: `${INVOICE}/invoices/:path*` },
      { source: '/api/invoices',                   destination: `${INVOICE}/invoices` },

      // ── Dispute service ──────────────────────────────────────────────────
      { source: '/api/disputes/:path*',            destination: `${DISPUTE}/disputes/:path*` },
      { source: '/api/disputes',                   destination: `${DISPUTE}/disputes` },

      // ── AI service ───────────────────────────────────────────────────────
      { source: '/api/ai/:path*',                  destination: `${AI}/:path*` },
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
