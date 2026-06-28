# NirmalMandi — Feature Backlog

Pipeline: **Build → Test → QA → Deploy → Verify**
Approach: One feature at a time, built across all three portals before moving to next.

---

## PHASE 1 — Dev Framework ✅ IN PROGRESS
- [x] GitHub Actions CI pipeline
- [x] Feature backlog document
- [ ] Daily standup template
- [ ] Production runbook

---

## PHASE 2 — Feature Completion (sequential)

### Feature 1: Edit Listing
**Portals affected:** Seller, Admin
- [ ] Seller: `seller/listings/[id]/edit/page.tsx` — pre-filled form, PATCH /inventory/listings/:id
- [ ] Admin: Edit button in admin inventory → same edit flow
- [ ] Test: unit test for PATCH endpoint
- [ ] QA: seller edits listing → admin sees updated listing → buyer sees updated listing
- **Status:** NOT STARTED

### Feature 2: KYC
**Portals affected:** Seller, Admin
- [ ] Seller: `seller/kyc/page.tsx` — status display, document upload UI, tier progression
- [ ] Admin: KYC queue already exists, verify approve/reject works end-to-end
- [ ] Test: KYC status update test
- [ ] QA: seller submits KYC → admin sees in queue → admin approves → seller status updates
- **Status:** NOT STARTED

### Feature 3: Notifications
**Portals affected:** Seller, Buyer, Admin
- [ ] Seller: `seller/notifications/page.tsx` — list, mark read, mark all read
- [ ] Buyer: `/notifications` page — already exists, verify working
- [ ] Admin: broadcast panel, notification logs — verify working
- [ ] Test: notification delivery test
- [ ] QA: admin broadcasts → seller + buyer see it in their notification pages
- **Status:** NOT STARTED

### Feature 4: Order Detail & Dispute Flow
**Portals affected:** Seller, Buyer, Admin
- [ ] Seller: order detail view with shipment tracking, mark delivered
- [ ] Buyer: order detail with timeline, confirm delivery, raise dispute
- [ ] Admin: dispute resolution panel — verify end-to-end
- [ ] QA: buyer orders → seller ships → buyer confirms → escrow released → admin sees completed
- **Status:** NOT STARTED

### Feature 5: Payments & Checkout
**Portals affected:** Buyer, Admin
- [ ] Buyer: Razorpay checkout modal wired to real test keys
- [ ] Admin: payment/escrow tracking in transactions panel
- [ ] QA: test payment → escrow held → listing inventory decremented
- **Status:** BLOCKED (needs Razorpay test keys)

### Feature 6: Analytics Completion
**Portals affected:** Seller, Admin
- [ ] Seller: analytics page verified — charts rendering, real data
- [ ] Admin: GMV chart, seller scorecard, demand-supply chart
- [ ] QA: create listing + order → verify analytics update within 1 minute
- **Status:** NOT STARTED

### Feature 7: Seller Payouts
**Portals affected:** Seller, Admin
- [ ] Seller: payouts history, escrow summary — verify real data
- [ ] Admin: approve/hold/release payout actions working end-to-end
- [ ] QA: complete order → payout scheduled → admin approves → seller sees in payouts
- **Status:** NOT STARTED

### Feature 8: Search
**Portals affected:** Buyer (public)
- [ ] Search bar on marketplace → real Elasticsearch results
- [ ] Filters (sector, price, location) working with search
- [ ] QA: create listing → appears in search within 30 seconds
- **Status:** NOT STARTED

---

## PHASE 3 — Hardening
- [ ] S3 image upload (real CDN, not data URLs)
- [ ] Email notifications (Resend, after domain purchase)
- [ ] Mobile app deploy (Expo)
- [ ] Load testing
- [ ] Domain setup + SSL

---

## Blocked Items (need external action)
| Item | Blocker | Who |
|------|---------|-----|
| Payments | Razorpay test keys needed | Kumar |
| Email | Domain purchase (~2 weeks) | Kumar |
| S3 images | AWS keys needed | Kumar |
