/** @type {import('next').NextConfig} */
// Service URLs — set these as env vars in Vercel:
//   AUTH_SERVICE_URL      INVENTORY_SERVICE_URL  ORDER_SERVICE_URL
//   SEARCH_SERVICE_URL    PAYMENT_SERVICE_URL    NOTIFICATION_SERVICE_URL
//   LOGISTICS_SERVICE_URL ANALYTICS_SERVICE_URL  INVOICE_SERVICE_URL
//   DISPUTE_SERVICE_URL   AI_SERVICE_URL
const AUTH       = process.env.AUTH_SERVICE_URL        || 'https://nirmalmandiauth-service-production.up.railway.app';
const INVENTORY  = process.env.INVENTORY_SERVICE_URL   || 'https://nirmalmandiinventory-service-production.up.railway.app';
const ORDER      = process.env.ORDER_SERVICE_URL       || 'https://nirmalmandiorder-service-production.up.railway.app';
const SEARCH     = process.env.SEARCH_SERVICE_URL      || 'https://nirmalmandisearch-service-production.up.railway.app';
const PAYMENT    = process.env.PAYMENT_SERVICE_URL     || 'https://nirmalmandipayment-service-production.up.railway.app';
const NOTIF      = process.env.NOTIFICATION_SERVICE_URL|| 'https://nirmalmandinotification-service-production.up.railway.app';
const LOGISTICS  = process.env.LOGISTICS_SERVICE_URL   || 'https://nirmalmandilogistics-service-production.up.railway.app';
const ANALYTICS  = process.env.ANALYTICS_SERVICE_URL   || 'https://nirmalmandianalytics-service-production.up.railway.app';
const INVOICE    = process.env.INVOICE_SERVICE_URL     || 'https://nirmalmandiinvoice-service-production.up.railway.app';
const DISPUTE    = process.env.DISPUTE_SERVICE_URL     || 'https://nirmalmandidispute-service-production.up.railway.app';
const AI         = process.env.AI_SERVICE_URL          || 'https://nirmalmandiai-service-production.up.railway.app';

module.exports = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
      // Email password + OTP + seller quick register
      { source: '/api/auth/email/:path*',        destination: `${AUTH}/auth/email/:path*` },
      { source: '/api/auth/seller/:path*',       destination: `${AUTH}/auth/seller/:path*` },
      { source: '/api/auth/verify-phone/:path*', destination: `${AUTH}/auth/verify-phone/:path*` },
      // Sprint 16 — DPDP consent + DocuSign
      { source: '/api/consent/:path*',           destination: `${AUTH}/consent/:path*` },
      { source: '/api/consent',                  destination: `${AUTH}/consent` },
      { source: '/api/esign/:path*',             destination: `${AUTH}/esign/:path*` },

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
      // Sprint 15 — Storefront
      { source: '/api/storefront/:path*',          destination: `${INVENTORY}/storefront/:path*` },
      { source: '/api/storefront',                 destination: `${INVENTORY}/storefront` },
      // Sprint 13 — Compliance
      { source: '/api/listings/:path*',            destination: `${INVENTORY}/listings/:path*` },

      // ── Order service ────────────────────────────────────────────────────
      { source: '/api/orders/:path*',              destination: `${ORDER}/orders/:path*` },
      { source: '/api/orders',                     destination: `${ORDER}/orders` },
      { source: '/api/cart/:path*',                destination: `${ORDER}/cart/:path*` },
      { source: '/api/cart',                       destination: `${ORDER}/cart` },
      { source: '/api/negotiations/:path*',        destination: `${ORDER}/negotiations/:path*` },
      { source: '/api/negotiations',               destination: `${ORDER}/negotiations` },
      // Sprint 13 — RFQ + voice messages
      { source: '/api/rfq/:path*',                 destination: `${ORDER}/rfq/:path*` },
      { source: '/api/rfq',                        destination: `${ORDER}/rfq` },

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
