/** @type {import('next').NextConfig} */
// Port map matches .env SERVICE_PORT vars:
// auth=3001 | inventory=3002 | order=3003 | payment=3004
// notification=3005 | invoice=3006 | logistics=3007 | analytics=3008
// dispute=3009 | web-portal=3010 | search=3012
module.exports = {
  async rewrites() {
    return [
      { source: '/api/auth/:path*',           destination: 'http://localhost:3001/auth/:path*' },
      { source: '/api/inventory/:path*',      destination: 'http://localhost:3002/inventory/:path*' },
      { source: '/api/orders/:path*',         destination: 'http://localhost:3003/orders/:path*' },
      { source: '/api/payments/:path*',       destination: 'http://localhost:3004/payments/:path*' },
      { source: '/api/notifications/:path*',  destination: 'http://localhost:3005/notifications/:path*' },
      { source: '/api/invoices/:path*',       destination: 'http://localhost:3006/invoices/:path*' },
      { source: '/api/logistics/:path*',      destination: 'http://localhost:3007/logistics/:path*' },
      { source: '/api/analytics/:path*',      destination: 'http://localhost:3008/analytics/:path*' },
      { source: '/api/disputes/:path*',       destination: 'http://localhost:3009/disputes/:path*' },
      { source: '/api/search/:path*',         destination: 'http://localhost:3012/search/:path*' },
      { source: '/api/ai/:path*',             destination: 'http://localhost:8000/:path*' },
    ];
  },
};
