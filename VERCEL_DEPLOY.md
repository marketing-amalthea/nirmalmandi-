# Vercel Deployment Steps for Nirmal Mandi

## Quick Start
You'll deploy two Next.js apps to Vercel:
1. **Web Portal** (web/) → Main marketplace for all users
2. **Admin Portal** (admin/) → Admin dashboard

---

## Prerequisites
1. ✅ Vercel account → [vercel.com](https://vercel.com)
2. ✅ GitHub repo connected to Vercel
3. ✅ Environment variables ready

---

## Step 1 — Deploy Web App

### 1a. Push to GitHub
```bash
git add .
git commit -m "Add Vercel configs for web and admin deployment"
git push origin main
```

### 1b. Deploy via Vercel CLI or Dashboard

**Option A: Vercel CLI (Recommended)**
```bash
npm install -g vercel
cd web
vercel --prod
# Select your GitHub org
# Select project scope: nirmalmandi-web
# Name: nirmalmandi-web
```

**Option B: Vercel Dashboard**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repo
4. Select root directory: `web`
5. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL` = Your Railway backend URL (e.g., `https://api.nirmalmandi.com`)
   - Any other NEXT_PUBLIC_* variables your app needs
6. Click "Deploy"

**Expected Result:**
- Live URL: `https://nirmalmandi-web.vercel.app` (or your custom domain)
- View routes:
  - `/` → Common portal (marketplace home)
  - `/buyer/*` → Buyer portal
  - `/seller/*` → Seller portal

---

## Step 2 — Deploy Admin App

### 2a. Deploy via Vercel CLI
```bash
cd ../admin
vercel --prod
# Select project scope: nirmalmandi-admin
# Name: nirmalmandi-admin
```

### 2b. Set Environment Variables in Vercel Dashboard
1. Go to Project Settings → Environment Variables
2. Add:
   - `NEXT_PUBLIC_API_URL` = Your Railway backend URL
   - `NEXT_PUBLIC_ADMIN_SECRET` = Your admin secret
   - Any other admin-specific variables

**Expected Result:**
- Live URL: `https://nirmalmandi-admin.vercel.app` (or your custom domain)
- Route: `/` → Admin dashboard

---

## Step 3 — Environment Variables Guide

### For Web App (web/.env.production)
```env
NEXT_PUBLIC_API_URL=https://api.nirmalmandi.com
NEXT_PUBLIC_NEON_DB_URL=postgresql://...@neon.tech/nirmalmandi
NEXT_PUBLIC_UPSTASH_REDIS_URL=rediss://...@upstash.io
```

### For Admin App (admin/.env.production)
```env
NEXT_PUBLIC_API_URL=https://api.nirmalmandi.com
NEXT_PUBLIC_ADMIN_SECRET=your-admin-secret-key
```

---

## Step 4 — Verify Deployments

### Check Status
- Web: `https://nirmalmandi-web.vercel.app` (or custom domain)
- Admin: `https://nirmalmandi-admin.vercel.app` (or custom domain)

### Test Connectivity
1. Open web app, check browser console for API errors
2. Verify common portal loads (/) 
3. Navigate to /buyer and /seller routes
4. Open admin app, verify authentication works

---

## Step 5 — Custom Domains (Optional)
1. In Vercel Dashboard → Project Settings → Domains
2. Add your domain (e.g., `app.nirmalmandi.com`, `admin.nirmalmandi.com`)
3. Point DNS to Vercel

---

## Troubleshooting

### Build Fails
- Check `npm run build` locally: `cd web && npm run build`
- Verify all env vars are set in Vercel dashboard
- Check for TypeScript errors: `npm run type-check`

### API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` points to correct Railway service URL
- Check Railway services are still online: [railway.app/dashboard](https://railway.app/dashboard)
- Test from browser: `curl https://your-api-url/health`

### Blank Page
- Check browser DevTools Console for errors
- Verify Next.js build output: `npm run build`
- Check Vercel deployment logs in dashboard

---

## Four Dashboards Live URLs

Once deployed:

| Dashboard | URL |
|---|---|
| **Common Portal** | `https://nirmalmandi-web.vercel.app` |
| **Buyer Portal** | `https://nirmalmandi-web.vercel.app/buyer` |
| **Seller Portal** | `https://nirmalmandi-web.vercel.app/seller` |
| **Admin Portal** | `https://nirmalmandi-admin.vercel.app` |

---

## Next: Open All Dashboards
Once URLs are live, we'll open all four in the browser! 🚀
