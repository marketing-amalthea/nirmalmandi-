# NirmalMandi — Build Plan
**Locked: 2026-05-31 | 3 Phases · 16 Sprints**

---

## PHASE 1 — MVP
> Goal: Real end-to-end transaction possible. Seller registers → lists → buyer discovers → pays via escrow → gets notified.

### Sprint 1 — Transaction Foundation ✅
- [x] `/auth/verify-bank` + `/auth/kyc-upload-url` endpoints added to auth-service
- [x] `002_missing_columns.sql` — adds fcm_token, seller address fields, negotiation_offers, auction_bids, saved_searches, buyer_addresses, ai_credits_log, referrals, dispute evidence
- [x] Notification processor `full_name` → `name` column fix
- [ ] Docker-compose local boot (all services green)
- [ ] AWS RDS + ElastiCache + OpenSearch dev provisioning
- [ ] Standardise `req.user.sub` across all services (Tech Lead)

### Sprint 2 — Payment + Listings Core ✅
- [x] Razorpay checkout fully wired (web) — order → payment initiation → Razorpay modal
- [x] GST breakdown in checkout (subtotal + platform fee + GST on fee + freight)
- [x] Lot calculator on listing detail (quantity → total, per-unit, resale, margin)
- [x] Sector-specific field display on listing detail
- [x] `/admin/stats/dashboard` + `/admin/stats/gmv` + `/admin/stats/alerts` endpoints
- [x] Admin dashboard wired to statsApi
- [x] Delhivery freight estimate wired — rewrite fixed, logisticsApi added, checkout uses buyer pincode + weight estimate

### Sprint 3 — AI Marketing Panel + Notifications ✅
- [x] `MarketingPanel.tsx` web component — language/tone/platform selectors, AI caption, copy, share
- [x] "Generate Marketing Content" button on listing detail
- [x] `marketing.tsx` mobile screen — full AI caption UI with share
- [x] FCM service fully built (Firebase Admin SDK)
- [x] WhatsApp service fully built (Twilio + Hindi templates)
- [x] Notification queue processor (Bull + Redis) — wires FCM + WhatsApp
- [ ] Add OPENAI_API_KEY or ANTHROPIC_API_KEY to `.env` and test AI endpoints

### Sprint 4 — AI Listing Flow + QA
- [ ] AI Listing 6-step flow on web (`/seller/listings/new`) — prompt → category → vision → pricing → lot → preview
- [ ] Order tracking timeline view (7-stage visual)
- [ ] Flash sale horizontal strip with countdown timers on home
- [ ] AI match banner on home ("X deals matched today")
- [ ] KYC document viewer in admin panel
- [ ] Postman happy-path collection (register → list → buy → escrow → notify)
- [ ] Integration test — auth flow (OTP → register → JWT → protected route)

---

## PHASE 2 — Post-Launch (Weeks 5-10)

### Sprint 5 — Negotiation Flow ✅
- [x] `negotiation.ts` service fully implemented (initiate, counter, accept, reject, 5-round limit, 48h expiry)
- [x] `auction.ts` service fully implemented (WebSocket bids, anti-sniping, outbid notifications)
- [x] Both registered in `order-service/src/index.ts` — WebSocket at `/ws/auction`
- [x] `NegotiationModal.tsx` — Make Offer button, AI fair price suggestion, offer thread
- [x] `negotiationsApi` added to `web/src/lib/api.ts`
- [ ] Negotiation thread polling / real-time updates on web

### Sprint 6 — Auction UI + WebSocket Frontend ✅
- [x] Auction listing UI — AuctionPanel.tsx — live bid, countdown, bidder count, quick-bid buttons
- [x] WebSocket client hook (`useAuction.ts`) — auto-reconnect, outbid toast, room join/leave
- [x] Outbid push notification trigger — `notifyOutbid()` in auction.ts → notification service
- [x] Reserve not met UI — shown in AuctionPanel bid stats when highestBid < reservePrice
- [x] Bid increment validation — frontend: `amount < minNextBid` guard; backend: same check

### Sprint 7 — Buyer Intelligence + Search ✅
- [x] Save search with push notification alerts (localStorage-based, push alert infra ready)
- [x] Watchlist price drop alert background job — scheduler.ts 6h cron → notification service
- [x] Voice search mic (Web Speech API, Hindi + English) — already built, discovered
- [ ] AI search autocomplete from `/search/suggest`
- [x] Side-by-side lot comparison (up to 3 listings) — CompareDrawer.tsx + ListingCard compare toggle
- [x] Buyer Tier 2 verification flow (checkout > ₹1L) — TierVerifyModal.tsx gate in handlePay
- [x] Buyer Tier 3 verification flow (checkout > ₹10L) — same modal, tier=3 path
- [x] "Market Again" + Reorder in purchase history — already built
- [x] CSV export in purchase history — exportCSV() downloads .csv

### Sprint 8 — Seller Intelligence ✅
- [x] Per-listing performance metrics — `GET /seller/listings/:id/performance` in analytics-service; inline expand row in seller listings table (views/day, inquiries, CVR, 10d sparkline)
- [x] AI urgency score on seller listing cards — colour-coded progress bar — already built, discovered
- [x] Bulk actions — pause/unpause/delist/price change — already built, discovered
- [x] Seller analytics — revenue chart, category performance, funnel — already built, discovered
- [x] AI insights panel — rule-based (3 conditions) + "Ask Claude" button → ai-service `/ai/seller/insights` (new endpoint)
- [x] Inventory aging alerts on seller dashboard — already built, discovered
- [x] Mobile seller analytics tab — `mobile/app/(seller)/analytics.tsx` — KPI grid, funnel, top listings, AI insight teaser

### Sprint 9 — Admin Intelligence + 3PL ✅
- [x] Inventory age heatmap — `GET /admin/stats/inventory-heatmap` + `InventoryHeatmap` component (5 age buckets, per-sector stacked bar)
- [x] Demand-supply gap — `GET /admin/stats/demand-supply` + `DemandSupplyChart` (views vs listings dual bar per sector)
- [x] Seller performance scorecard — `GET /admin/stats/seller-scorecard` + `SellerScorecard` table (GMV, orders, score, dispute%, fill%)
- [x] Category management — approve/reject — already built in categories admin page (discovered)
- [x] Real-time transaction feed — already built via `/admin/stats/recent-transactions` (discovered)
- [x] Delhivery 3PL — `POST /logistics/shipments/book-delhivery` — calls Delhivery pickup API, stores AWB + tracking URL
- [x] Shiprocket integration — `POST /logistics/shipments/book-shiprocket` — Shiprocket auth + order creation, stores AWB
- [x] Live logistics tracking in order detail — `LiveTrackingCard` component, fetches `GET /logistics/shipments/order/:id`, 5-stage visual timeline, 60s auto-refresh

### Sprint 10 — Referral Engine + BI Engines 1-4 ✅
- [x] Referral engine — unique link, conversion tracking, commission calc — already built in auth-service/profile.ts
- [x] Tiered rewards (Silver/Gold/Platinum) — fully built in web/src/app/referral/page.tsx
- [x] Referral dashboard — QR code via qrserver.com API (no package), WhatsApp share, copy, payout history
- [x] BI Engine 1: Sales velocity — salesVelocity.ts + GET /analytics/sales-velocity/:id — already built
- [x] BI Engine 2: Demand-supply gap — demandSupply.ts + GET /analytics/demand-supply-gap — already built
- [x] BI Engine 3: Revenue forecast — revenueForecast.ts + GET /analytics/revenue-forecast — already built
- [x] BI Engine 4: Inventory aging risk — agingRisk.ts + GET /analytics/aging-risk — already built
- [x] Weekly auto-report email — scheduler.ts runs every 5min, fires on Monday 02:30 UTC (08:00 IST), sends HTML report to platform_settings.weekly_report_emails
- [x] Configurable KPI alert thresholds — 5 new defaults in adminSettings.ts (GMV drop%, dispute rate%, aging days, CVR%, report emails), full UI in admin settings page

---

## PHASE 3 — V2.0 (Weeks 11-16)

### Sprint 11 — AI Marketing Phase B (Branded Graphics)
- [ ] AI branded graphic generator (product image + price overlay + deal badge)
- [ ] Format selector (Square/Horizontal/Vertical)
- [ ] AI credit system (5 free/day, deduct from balance)
- [ ] Credit balance shown in marketing panel

### Sprint 12 — Agent Web Panel + Voice TTS
- [ ] Agent side panel on web (collapsible right panel)
- [ ] Wire agent tool execution (search_listings, get_order_status, etc.)
- [ ] Google TTS voice responses
- [ ] Voice input mic on web (Whisper)

### Sprint 13 — RFQ + PO System
- [ ] RFQ (Request for Quotation) flow
- [ ] Purchase Order generation (PDF)
- [ ] Sector-specific compliance checks (drug license, RTO)
- [ ] In-app voice messages

### Sprint 14 — BI Engines 5-8 + Board Reports
- [ ] BI Engine 5: Buyer behavior event stream → ClickHouse
- [ ] BI Engine 6: Seller acquisition targeting
- [ ] BI Engine 7: CVR optimization signals
- [ ] BI Engine 8: Geographic demand mapping
- [ ] Board-ready PDF export

### Sprint 15 — Reseller Storefront + Multi-Language
- [ ] Reseller storefront (personal mini-catalogue with shareable link)
- [ ] Reseller margin setting
- [ ] Multi-language captions (Gujarati, Punjabi, Marathi)
- [ ] AI image enhancement of product photos
- [ ] Video reel script generation

### Sprint 16 — Production + Hardening
- [ ] Car carrier + cold chain + digital delivery logistics
- [ ] BNPL integration
- [ ] Seller e-signature on registration (DocuSign)
- [ ] DPDP Act 2023 compliance (consent management)
- [ ] TCS under GST marketplace operator rules
- [ ] Full E2E test suite
- [ ] AWS ECS Fargate production deploy
- [ ] Datadog monitoring

---

## Confirmed Cuts (not building)
- Custom ML model training — use Claude/OpenAI until Phase 3 data exists
- MLOps pipeline
- Blockchain escrow
- General messaging (deal-scoped negotiation chat only)
- App Store / Play Store submission (Expo Go for MVP, stores in Phase 2)

---

## Execution Command
Say `start Sprint X` in any session and the agent builds it immediately — backend first, frontend wired, verified.
