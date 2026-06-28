# NirmalMandi — Production Runbook

## Infrastructure
| Component | Platform | URL | Owns |
|-----------|----------|-----|------|
| Web portal | Vercel | nirmalmandi-web.vercel.app | kumarsahilrs/Neutral-Mart |
| Admin portal | Vercel | nirmalmandi-admin.vercel.app | kumarsahilrs/Neutral-Mart |
| 12 backend services | Railway | *.up.railway.app | marketing-amalthea/nirmalmandi- |
| PostgreSQL | Neon | ep-snowy-sound-aovv6nm9... | Transfer to Kumar's account |
| Redis | Upstash | rediss://... | Transfer to Kumar's account |

---

## Deploy — Standard Flow

```bash
# After feature is built and tested locally:
git add .
git commit -m "feat: [feature name] — [what it does]"
git push kumar master    # triggers Vercel rebuild (web + admin)
git push deploy master   # triggers Railway rebuild (all services)
git push origin master   # source of truth backup
```

**Wait times:**
- Vercel: ~2 min
- Railway (per service): ~3 min
- All 12 services: ~15 min total (parallel)

---

## Rollback

### Rollback Vercel (web/admin)
```bash
# Find last good commit
git log --oneline -10

# Revert to last good commit
git revert HEAD  # reverts last commit
git push kumar master
# Vercel auto-deploys the reverted version
```

### Rollback Railway (backend)
Railway dashboard → service → Deployments → click previous green deploy → **Redeploy**

Or via git:
```bash
git revert HEAD
git push deploy master
```

---

## Add a New Service

1. Create `packages/[service-name]/` with:
   - `src/index.ts`
   - `package.json`
   - `tsconfig.json`
   - `railway.toml`

2. Add to root `package.json` workspaces

3. Add to `nixpacks.toml` build commands

4. Add Railway service:
   - Railway → New Service → GitHub Repo → Set root dir
   - Add env vars: `DATABASE_URL`, `REDIS_URL`, `INTERNAL_SERVICE_SECRET`

5. Add proxy rewrite to `web/next.config.js` and `admin/next.config.js`

6. Push and verify `/health` endpoint responds

---

## Emergency Procedures

### Kill the entire app (if needed)
```
Option 1 — Rotate DB password in Neon → all services 500 immediately
Option 2 — Railway → project → Settings → Delete project
Option 3 — Vercel → project → Settings → Delete project
```

### Service is down (502)
1. Railway → service → Deployments → check build logs
2. Common causes: TypeScript error, missing env var, DB connection
3. Fix → push → Railway auto-redeploys

### Database emergency
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Kill long-running queries
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE duration > interval '5 minutes';
```

---

## Environment Variables (per service)

All services need (set as Railway shared variables):
```
DATABASE_URL = postgresql://...neon.tech/neondb?sslmode=require
REDIS_URL = rediss://...upstash.io:port
INTERNAL_SERVICE_SECRET = nm-jwt-secret-2026
```

Service-specific:
```
# inventory-service
OPENAI_API_KEY = sk-...

# payment-service
RAZORPAY_KEY_ID = rzp_test_...
RAZORPAY_KEY_SECRET = ...
RAZORPAY_WEBHOOK_SECRET = ...

# notification-service
RESEND_API_KEY = re_...
FAST2SMS_API_KEY = ...
```

---

## Monitoring

**Check service health:**
```bash
curl https://nirmalmandiinventory-service-production.up.railway.app/health
curl https://nirmalmandiauth-service-production.up.railway.app/health
```

**Check DB connection:**
```sql
-- Run in Neon SQL editor
SELECT NOW();  -- should return current timestamp
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM listings WHERE status = 'live';
```

---

## Running Tests
```bash
# All tests
npm test

# Single service
npm test --workspace=packages/auth-service

# With coverage
npm test -- --coverage

# E2E (when Playwright configured)
npx playwright test
```
