/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Auth
      { source: '/api/auth/:path*', destination: 'http://localhost:3001/auth/:path*' },
      // Admin stats → analytics service
      { source: '/api/admin/stats/:path*', destination: 'http://localhost:3008/admin/stats/:path*' },
      // Admin inventory → inventory service
      { source: '/api/admin/inventory/:path*', destination: 'http://localhost:3002/admin/inventory/:path*' },
      { source: '/api/admin/inventory', destination: 'http://localhost:3002/admin/inventory' },
      // Admin transactions/orders → order service
      { source: '/api/admin/transactions/:path*', destination: 'http://localhost:3003/admin/transactions/:path*' },
      { source: '/api/admin/transactions', destination: 'http://localhost:3003/admin/transactions' },
      // Admin disputes → order service (has dispute routes)
      { source: '/api/admin/disputes/:path*', destination: 'http://localhost:3003/admin/disputes/:path*' },
      { source: '/api/admin/disputes', destination: 'http://localhost:3003/admin/disputes' },
      // Admin users → auth service
      { source: '/api/admin/users/:path*', destination: 'http://localhost:3001/admin/users/:path*' },
      { source: '/api/admin/users', destination: 'http://localhost:3001/admin/users' },
      // Admin categories (sectors) → inventory service
      { source: '/api/admin/categories/:path*', destination: 'http://localhost:3002/admin/categories/:path*' },
      { source: '/api/admin/categories', destination: 'http://localhost:3002/admin/categories' },
      // Admin settings → analytics service
      { source: '/api/admin/settings/:path*', destination: 'http://localhost:3008/admin/settings/:path*' },
      { source: '/api/admin/settings', destination: 'http://localhost:3008/admin/settings' },
      // Admin notifications → notification service
      { source: '/api/admin/notifications/:path*', destination: 'http://localhost:3005/notifications/admin/:path*' },
      // Generic service routes
      { source: '/api/inventory/:path*', destination: 'http://localhost:3002/inventory/:path*' },
      { source: '/api/orders/:path*', destination: 'http://localhost:3003/orders/:path*' },
      { source: '/api/payments/:path*', destination: 'http://localhost:3004/payments/:path*' },
      { source: '/api/analytics/:path*', destination: 'http://localhost:3008/analytics/:path*' },
    ];
  },
  images: {
    domains: ['storage.googleapis.com', 'cdn.nirmalmandi.com'],
  },
};

module.exports = nextConfig;
