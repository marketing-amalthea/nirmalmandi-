# NirmalMandi Production Deploy Runbook
**Hour 20 checklist — execute in order**

## Pre-deploy
- [ ] All unit tests pass: `npm test --workspace=packages/shared`
- [ ] Commission test: `₹2,00,000 automobiles → net=194460` ✓
- [ ] GST test: `DL→DL ₹1,00,000 18% → cgst=9000, sgst=9000` ✓
- [ ] All Dockerfiles build cleanly
- [ ] `.env.production` populated (all REQUIRED vars below)

## Required ENV vars (production)
```
DATABASE_URL=postgresql://nm_prod:PASS@RDS_ENDPOINT:5432/nirmalmandi
REDIS_URL=redis://ELASTICACHE_ENDPOINT:6379
ELASTICSEARCH_URL=https://OPENSEARCH_ENDPOINT
JWT_PRIVATE_KEY=<RS256 private key PEM>
JWT_PUBLIC_KEY=<RS256 public key PEM>
ANTHROPIC_API_KEY=sk-ant-...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155238886
FIREBASE_PROJECT_ID=nirmalmandi
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@nirmalmandi.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=...
AWS_REGION=ap-south-1
S3_BUCKET_NAME=nirmalmandi-assets
CLOUDFRONT_URL=https://d1234567890.cloudfront.net
PLATFORM_GSTIN=27AABCA1234A1Z5
INTERNAL_SERVICE_SECRET=<random 64-char hex>
DELHIVERY_TOKEN=...
KARZA_API_KEY=...
```

## Step 1 — Database
```bash
# Run migration on RDS
psql $DATABASE_URL < infra/migrations/001_initial_schema.sql

# Verify sectors seeded
psql $DATABASE_URL -c "SELECT slug, commission_rate FROM sectors;"
# Should show 7 rows: automobiles, clothing, furniture, fmcg, pharma, software, machinery

# Create admin user
psql $DATABASE_URL -c "
  INSERT INTO users (id, phone, role, full_name, is_verified)
  VALUES (gen_random_uuid(), '+919876543210', 'admin', 'Sidhant Lakhan', true);
"
```

## Step 2 — ECR + Docker Build
```bash
# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin $ECR_REGISTRY

SERVICES=(auth-service inventory-service order-service payment-service notification-service invoice-service logistics-service analytics-service dispute-service search-service)

for SERVICE in "${SERVICES[@]}"; do
  docker build -f packages/$SERVICE/Dockerfile -t $ECR_REGISTRY/nm-$SERVICE:latest .
  docker push $ECR_REGISTRY/nm-$SERVICE:latest
done

# AI service
docker build -f ai-service/Dockerfile -t $ECR_REGISTRY/nm-ai-service:latest .
docker push $ECR_REGISTRY/nm-ai-service:latest

# Admin
docker build -f admin/Dockerfile -t $ECR_REGISTRY/nm-admin:latest .
docker push $ECR_REGISTRY/nm-admin:latest
```

## Step 3 — ECS Deploy
```bash
# Update each ECS service (triggers rolling deploy)
CLUSTER=nirmalmandi-prod

for SERVICE in "${SERVICES[@]}"; do
  aws ecs update-service --cluster $CLUSTER --service nm-$SERVICE --force-new-deployment
  aws ecs wait services-stable --cluster $CLUSTER --services nm-$SERVICE
  echo "$SERVICE stable ✓"
done
```

## Step 4 — Elasticsearch Index
```bash
# Create nm_listings index (inventory-service does this on startup)
# Verify manually:
curl -X GET "$ELASTICSEARCH_URL/nm_listings/_mapping" | jq '.nm_listings.mappings.properties | keys'
# Should show: title, sector_slug, city, state, asking_price, urgency_score, etc.
```

## Step 5 — DNS + SSL
1. Route53: `api.nirmalmandi.com` → ALB (backend services via path routing)
2. Route53: `admin.nirmalmandi.com` → ECS admin service
3. Certificate Manager: `*.nirmalmandi.com` wildcard cert, auto-renew
4. CloudFront: `assets.nirmalmandi.com` → S3 bucket with OAI

## Step 6 — WAF Rules
```bash
aws wafv2 create-web-acl \
  --name nirmalmandi-waf \
  --scope REGIONAL \
  --default-action Allow={} \
  --rules file://infra/waf-rules.json  # rate limit 100 req/min per IP
```

## Step 7 — Smoke Tests
```bash
BASE=https://api.nirmalmandi.com

# Health checks
for PORT in 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010; do
  echo -n "Port $PORT: "
  curl -s $BASE:$PORT/health | jq .status
done

# OTP flow (dev mode)
curl -X POST $BASE/auth/otp/send -H 'Content-Type: application/json' \
  -d '{"phone":"+919876543210"}' | jq .

# Search
curl "$BASE/search?q=fmcg" | jq '.data.total'
```

## Step 8 — Post-deploy verification
- [ ] Admin login works at `admin.nirmalmandi.com`
- [ ] Test listing creation via AI prompt
- [ ] Test order flow: buyer login → search → add to cart → checkout → payment (Razorpay test mode)
- [ ] Verify invoice generated on payment.captured webhook
- [ ] Verify escrow created and shows 'holding'
- [ ] Verify WhatsApp notification received (test number)
- [ ] Analytics dashboard loads KPIs

## Rollback
```bash
# ECS rollback to previous task definition
aws ecs update-service \
  --cluster $CLUSTER \
  --service nm-auth-service \
  --task-definition nm-auth-service:PREVIOUS_REVISION
```

## Admin Credentials
- URL: https://admin.nirmalmandi.com
- Phone: +919876543210 (Sidhant Lakhan)
- OTP: sent to registered phone via Twilio
- Role: admin (set in DB above)
