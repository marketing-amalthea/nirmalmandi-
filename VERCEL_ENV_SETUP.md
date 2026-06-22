# Environment Variables Setup for Vercel

## For WEB App (nirmalmandi-web)

### MINIMUM Required:
```
NEXT_PUBLIC_API_URL = https://your-api-gateway-or-auth-service-url
```

### Optional (if you want all services exposed):
```
NEXT_PUBLIC_AUTH_SERVICE_URL = https://auth-service-XXXX.up.railway.app
NEXT_PUBLIC_INVENTORY_SERVICE_URL = https://inventory-service-XXXX.up.railway.app
NEXT_PUBLIC_ORDER_SERVICE_URL = https://order-service-XXXX.up.railway.app
NEXT_PUBLIC_SEARCH_SERVICE_URL = https://search-service-XXXX.up.railway.app
NEXT_PUBLIC_PAYMENT_SERVICE_URL = https://payment-service-XXXX.up.railway.app
NEXT_PUBLIC_NOTIFICATION_SERVICE_URL = https://notification-service-XXXX.up.railway.app
NEXT_PUBLIC_LOGISTICS_SERVICE_URL = https://logistics-service-XXXX.up.railway.app
NEXT_PUBLIC_ANALYTICS_SERVICE_URL = https://analytics-service-XXXX.up.railway.app
NEXT_PUBLIC_INVOICE_SERVICE_URL = https://invoice-service-XXXX.up.railway.app
NEXT_PUBLIC_DISPUTE_SERVICE_URL = https://dispute-service-XXXX.up.railway.app
NEXT_PUBLIC_AI_SERVICE_URL = https://ai-service-XXXX.up.railway.app
```

---

## For ADMIN App (nirmalmandi-admin)

### MINIMUM Required:
```
NEXT_PUBLIC_API_URL = https://your-api-gateway-or-auth-service-url
NEXT_PUBLIC_ADMIN_SECRET = your-admin-secret-key-here
```

### Optional:
```
NEXT_PUBLIC_AUTH_SERVICE_URL = https://auth-service-XXXX.up.railway.app
NEXT_PUBLIC_ANALYTICS_SERVICE_URL = https://analytics-service-XXXX.up.railway.app
```

---

## How to Get Your Railway URLs

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click on your project: `nirmalmandi-backend`
3. For each service (auth-service, order-service, etc.):
   - Click the service
   - Click "Settings"
   - Look for "Public URL" or "Domain"
   - Copy the HTTPS URL (format: `https://service-name-XXXX.up.railway.app`)

---

## Steps to Add Env Vars in Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project (e.g., `nirmalmandi-web`)
3. Go to **Settings** → **Environment Variables**
4. Click "Add New"
5. Fill in:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://your-url-from-railway`
   - **Environments**: Select all (Production, Preview, Development)
6. Click "Add"
7. Repeat for other variables

---

## ⚠️ Important

- Variables starting with `NEXT_PUBLIC_` are exposed to the browser (safe for public API URLs)
- Variables NOT starting with `NEXT_PUBLIC_` are private (backend only)
- After adding env vars, Vercel will **auto-redeploy** your app

---

## Need Your Railway URLs?

Please provide the URLs for at least:
- **auth-service** 
- **order-service** (or main API gateway)

Then I can help you complete the setup!
