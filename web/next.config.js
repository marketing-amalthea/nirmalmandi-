/** @type {import('next').NextConfig} */
// Correct port map (matches .env SERVICE_PORT vars):
// auth=3001 | inventory=3002 | order=3003 | search=3004
// payment=3005 | notification=3006 | logistics=3007 | analytics=3008
// invoice=3009 | dispute=3010 | ai=8000
module.exports = {
  async rewrites() {
    return [
      // ── Auth service (3001) ──────────────────────────────────────────────
      { source: '/api/auth/:path*',              destination: 'http://localhost:3001/auth/:path*' },
      { source: '/api/profile/:path*',           destination: 'http://localhost:3001/profile/:path*' },
      // User addresses + referral live on auth profile routes
      { source: '/api/user/addresses',           destination: 'http://localhost:3001/profile/addresses' },
      { source: '/api/user/addresses/:path*',    destination: 'http://localhost:3001/profile/addresses/:path*' },
      { source: '/api/referral/stats',           destination: 'http://localhost:3001/profile/referral' },
      { source: '/api/referral/:path*',          destination: 'http://localhost:3001/profile/referral/:path*' },

      // ── Inventory service (3002) ─────────────────────────────────────────
      // Service mounts at /listings and /sectors (no /inventory prefix on the service)
      { source: '/api/inventory/listings/:path*',  destination: 'http://localhost:3002/listings/:path*' },
      { source: '/api/inventory/listings',         destination: 'http://localhost:3002/listings' },
      { source: '/api/inventory/sectors/:path*',   destination: 'http://localhost:3002/sectors/:path*' },
      { source: '/api/inventory/sectors',          destination: 'http://localhost:3002/sectors' },
      { source: '/api/inventory/images/:path*',    destination: 'http://localhost:3002/images/:path*' },
      // Seller listing management (inventory /seller routes)
      { source: '/api/seller/listings/:path*',     destination: 'http://localhost:3002/seller/listings/:path*' },
      { source: '/api/seller/listings',            destination: 'http://localhost:3002/seller/listings' },
      // Buyer watchlist (inventory /listings/:id/watchlist)
      { source: '/api/buyer/watchlist',            destination: 'http://localhost:3002/buyer/watchlist' },
      { source: '/api/buyer/:path*',               destination: 'http://localhost:3002/buyer/:path*' },

      // ── Order service (3003) ─────────────────────────────────────────────
      { source: '/api/orders/:path*',              destination: 'http://localhost:3003/orders/:path*' },
      { source: '/api/orders',                     destination: 'http://localhost:3003/orders' },
      { source: '/api/cart/:path*',                destination: 'http://localhost:3003/cart/:path*' },
      { source: '/api/cart',                       destination: 'http://localhost:3003/cart' },
      { source: '/api/negotiations/:path*',        destination: 'http://localhost:3003/negotiations/:path*' },
      { source: '/api/negotiations',               destination: 'http://localhost:3003/negotiations' },

      // ── Search service (3004) ────────────────────────────────────────────
      { source: '/api/search/:path*',              destination: 'http://localhost:3004/search/:path*' },

      // ── Payment service (3005) ───────────────────────────────────────────
      { source: '/api/payments/:path*',            destination: 'http://localhost:3005/payments/:path*' },
      { source: '/api/payments',                   destination: 'http://localhost:3005/payments' },

      // ── Notification service (3006) ──────────────────────────────────────
      { source: '/api/notifications/:path*',       destination: 'http://localhost:3006/notifications/:path*' },
      { source: '/api/notifications',              destination: 'http://localhost:3006/notifications' },

      // ── Logistics service (3007) ─────────────────────────────────────────
      { source: '/api/logistics/:path*',           destination: 'http://localhost:3007/logistics/:path*' },

      // ── Analytics service (3008) ─────────────────────────────────────────
      // Seller dashboard + analytics live here
      { source: '/api/seller/dashboard',           destination: 'http://localhost:3008/seller/dashboard' },
      { source: '/api/seller/analytics',           destination: 'http://localhost:3008/seller/analytics' },
      { source: '/api/seller/:path*',              destination: 'http://localhost:3008/seller/:path*' },
      { source: '/api/analytics/:path*',           destination: 'http://localhost:3008/analytics/:path*' },

      // ── Invoice service (3009) ───────────────────────────────────────────
      { source: '/api/invoices/:path*',            destination: 'http://localhost:3009/invoices/:path*' },
      { source: '/api/invoices',                   destination: 'http://localhost:3009/invoices' },

      // ── Dispute service (3010) ───────────────────────────────────────────
      { source: '/api/disputes/:path*',            destination: 'http://localhost:3010/disputes/:path*' },
      { source: '/api/disputes',                   destination: 'http://localhost:3010/disputes' },

      // ── AI service (8000) ────────────────────────────────────────────────
      { source: '/api/ai/:path*',                  destination: 'http://localhost:8000/:path*' },
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
