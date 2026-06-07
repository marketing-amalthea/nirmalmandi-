# NirmalMandi — Work Log
**Running record of what's been built. Updated after every sprint.**

---

## Session: 2026-06-04 — Sprint 10 (Referral + BI Engines)

### Discoveries (already built — confirmed by code audit)
- `packages/auth-service/src/routes/profile.ts` — `GET /profile/referral` fully implemented (referral_code, link, stats, history)
- `packages/analytics-service/src/engines/` — all 4 BI engines fully implemented (salesVelocity, demandSupply, agingRisk, revenueForecast)
- `packages/analytics-service/src/routes/analytics.ts` — all 4 engines wired to REST endpoints
- `web/src/app/referral/page.tsx` — full tier system, history, payouts, WhatsApp share — already built

### What was actually built this session

| File | What |
|---|---|
| `web/src/app/referral/page.tsx` | Added QR code using free `api.qrserver.com` API (100×100px, no package). Shows inline next to hero box with scan instructions |
| `packages/analytics-service/src/engines/scheduler.ts` | Weekly auto-report job — checks every 5min, fires on Monday 02:30 UTC (08:00 IST). Queries GMV/orders/new users/disputes/top sectors, builds HTML email, sends to `platform_settings.weekly_report_emails` |
| `packages/analytics-service/src/routes/adminSettings.ts` | 5 new KPI threshold defaults: `alert_gmv_drop_pct`, `alert_dispute_rate_pct`, `alert_aging_days`, `alert_low_cvr_pct`, `weekly_report_emails` |
| `admin/src/app/(dashboard)/settings/page.tsx` | New "KPI Alert Thresholds" section with 5 configured inputs (number + email fields). Weekly report email recipients input wired to scheduler |

### Build status: ~99% — Phase 1 & 2 COMPLETE

---

## Session: 2026-06-04 — Sprint 9 (Admin Intelligence + 3PL)

### What was built

#### Backend
| File | What |
|---|---|
| `packages/analytics-service/src/routes/adminStats.ts` | 3 new endpoints: `GET /admin/stats/inventory-heatmap` (5 age buckets × sector), `GET /admin/stats/demand-supply` (views+watchlists vs supply listings), `GET /admin/stats/seller-scorecard` (per-seller GMV/orders/score/rates, top 20) |
| `packages/logistics-service/src/routes/shipments.ts` | `POST /shipments/book-delhivery` — calls Delhivery pickup creation API, returns AWB. `POST /shipments/book-shiprocket` — Shiprocket auth + order creation, returns AWB. `GET /shipments/order/:order_id` — fetch shipment by order. Both booking endpoints update orders table with AWB + tracking_url |
| `infra/migrations/003_watchlist_and_compare.sql` | Added `shipments.status`, `shipments.updated_at`, `UNIQUE (order_id)` constraint |

#### Frontend — Admin
| File | What |
|---|---|
| `admin/src/lib/api.ts` | Added `adminAnalyticsApi` — `getInventoryHeatmap()`, `getDemandSupply()`, `getSellerScorecard()` |
| `admin/src/app/(dashboard)/analytics/page.tsx` | 3 new components: `InventoryHeatmap` (stacked proportional bars, color coded by age), `DemandSupplyChart` (dual bars per sector), `SellerScorecard` (sortable table with tier badges + color-coded metrics). All integrated into analytics page |

#### Frontend — Web
| File | What |
|---|---|
| `web/src/app/orders/[id]/page.tsx` | `LiveTrackingCard` — replaces static AWB display. Fetches `GET /api/logistics/shipments/order/:id`, shows 5-stage visual timeline (Booked → Picked Up → In Transit → Out for Delivery → Delivered), 60s auto-refresh, expected delivery date |

### Build status: ~95% complete

---

## Session: 2026-06-04 — Sprint 8 (Seller Intelligence)

### What was built

#### Backend
| File | What |
|---|---|
| `packages/analytics-service/src/routes/seller.ts` | Added `GET /seller/listings/:id/performance` — views/day, inquiries, orders, CVR, revenue, 14d synthetic trend |
| `web/next.config.js` | Added specific rewrite for `/api/seller/listings/:id/performance` → analytics-service (before inventory catch-all) |
| `ai-service/app/routers/seller.py` | NEW — `POST /ai/seller/insights` — Claude-powered seller analysis from KPI + funnel + top listing data |
| `ai-service/app/main.py` | Registered `seller_router` at `/ai/seller` |

#### Frontend — Web
| File | What |
|---|---|
| `web/src/app/seller/analytics/page.tsx` | Fixed `kpi.active_listings` → `kpis.active_listings` bug. Extracted `AIInsightsPanel` component — rule-based insights always shown + "Ask Claude" button fetches `/ai/seller/insights` on demand. Claude response shown in indigo card |

#### Frontend — Mobile
| File | What |
|---|---|
| `mobile/app/(seller)/analytics.tsx` | NEW — KPI grid (4 cards), conversion funnel row with CVR badge, top-5 listings table (views/orders/revenue/conv%), rule-based AI insight card |
| `mobile/app/(seller)/_layout.tsx` | Added Analytics tab (📈) between Orders and Profile |

### Build status: ~92% complete

---

## Session: 2026-06-04 — Sprint 7 (Buyer Intelligence)

### What was built

#### Backend
| File | What |
|---|---|
| `packages/analytics-service/src/engines/scheduler.ts` | Watchlist price-drop alert job — every 6h, finds >5% drops on watchlisted listings, posts FCM+in_app via notification service, marks `last_alert_sent_at` |
| `packages/inventory-service/src/routes/buyer.ts` | NEW — `/buyer/watchlist` GET/POST/DELETE. POST captures `price_at_save` from current asking_price |
| `packages/inventory-service/src/index.ts` | Registered `buyerRouter` at `/buyer` |
| `packages/inventory-service/src/routes/listings.ts` | Watchlist POST updated to capture `price_at_save` |
| `infra/migrations/003_watchlist_and_compare.sql` | `watchlist` table (id, buyer_id, listing_id, price_at_save, last_alert_sent_at). `seller_pincode` column on listings |

#### Frontend — Web
| File | What |
|---|---|
| `web/src/components/CompareDrawer.tsx` | NEW — Side-by-side comparison table for up to 3 listings. Shows best price/condition/quantity highlights. Sticky bottom drawer with close/clear |
| `web/src/components/ListingCard.tsx` | Added `compareSelected` + `onCompareToggle` props — "+ Compare" / "✓ Added" pill overlay |
| `web/src/app/listings/page.tsx` | CompareDrawer wired — `compareList` state, `handleCompareToggle` (max 3 guard), drawer at bottom |
| `web/src/components/TierVerifyModal.tsx` | NEW — Tier 2 (PAN upload) and Tier 3 (video KYC) verification modal |
| `web/src/app/checkout/page.tsx` | Tier gate in `handlePay` — auto-opens TierVerifyModal for >₹1L (tier 2) or >₹10L (tier 3), `tierVerified` state bypasses gate after submission |
| `web/src/app/orders/page.tsx` | `exportCSV()` function — downloads all visible orders as `.csv` with full breakdown. "Export CSV" button in page header |

### Build status: ~87% complete

---

## Session: 2026-06-04 — Sprint 6 Close-out + Freight Wire

### Discoveries (already built, confirmed by code audit)
- `useAuction.ts` — WebSocket hook ✅
- `AuctionPanel.tsx` — outbid toast, reserve-not-met label, bid increment guard ✅
- `auction.ts` — `notifyOutbid()` calls notification service ✅
- Sprint 6 was 100% complete, not partially done as BUILDPLAN suggested

### What was actually built this session

#### Bug Fix — Delhivery Freight Wiring
| File | What |
|---|---|
| `web/next.config.js` | Fixed logistics rewrite: `/api/logistics/:path*` → `http://localhost:3007/logistics/:path*` was wrong (service has no `/logistics` prefix). Now correctly maps `/freight/*` and `/shipments/*` |
| `web/src/lib/api.ts` | Added `logisticsApi.getFreightEstimate()` — typed params (origin_pincode, dest_pincode, weight_kg, cod) → `GET /logistics/freight/estimate` |
| `web/src/app/checkout/page.tsx` | Replaced broken `fetch('/api/logistics/freight-estimate?from=STATE')` with `logisticsApi.getFreightEstimate()`. Uses `selectedAddress.pincode` as dest, `listing.pincode ?? '110001'` as origin, `max(0.5, ceil(qty * 0.5))` kg weight estimate. Freight row now shows "Estimate unavailable" (not "Select freight option") on failure. Pay button disabled while loading or when estimate unavailable. |

### Build status update: ~82% complete

---

## Session: 2026-05-31 — Sprint 4-7 Continuation

### Built this session
| File | What |
|---|---|
| `web/src/hooks/useAuction.ts` | WebSocket hook — auto-reconnect, live bid events, outbid toast, room join/leave |
| `web/src/components/AuctionPanel.tsx` | Live auction UI — current bid, countdown, bidder count, quick-bid buttons, anti-sniping label, reserve status, Place Bid |
| `web/src/app/listings/[id]/page.tsx` | AuctionPanel for auction listings, Watchlist button (save/unsave with API), MarketingPanel auto-opens from `?market=1` |
| `web/src/app/listings/page.tsx` | Voice search mic (Web Speech API, Hindi + English) |
| `web/src/app/seller/listings/page.tsx` | AI urgency score column with colour-coded progress bar |
| `web/src/app/orders/page.tsx` | "Market Again" button (→ listing with ?market=1), "Reorder" button on completed orders |
| `web/src/components/NegotiationModal.tsx` | 15s polling for counter-offers, auto-close on accept/reject |
| `admin/src/app/(dashboard)/kyc/page.tsx` | Inline doc preview modal — PDF iframe + image viewer, Preview + external link |
| `web/src/app/seller/listings/new/page.tsx` | AI prompt panel (step 1) — conversational input, AI pre-fills form, sector auto-detection |
| `web/src/app/page.tsx` | AI match banner for logged-in buyers |
| `BUILDPLAN.md` | Full 16-sprint locked plan |

### Discoveries (already built, assumed missing)
- Bulk actions in seller listings ✅ (`selectedIds`, `bulkAction`, `bulkChangePrice`)
- Save search on listings page ✅
- Flash sale strip with live countdown ✅ (`FlashSaleCard` with `setInterval`)
- Order tracking 7-stage timeline ✅ (desktop horizontal + mobile vertical)
- KYC review panel ✅ (approve/reject with reason/request more docs)
- Seller analytics with KPI cards + revenue charts ✅
- Seller dashboard with aging alerts + quick actions ✅

### Build status update: ~82% complete

---

## Session: 2026-05-31 — Sprint Build (Heavy)

### What was discovered (previously assumed missing but already built)
- `auth-service/src/services/gstn.ts` — GSTN real API call already implemented (format check in dev, live API in prod)
- `auth-service/src/services/kyc.ts` — Penny drop via Karza API already implemented
- `auth-service/src/routes/auth.ts` — Full seller + buyer registration, OTP, JWT, refresh, logout
- `web/src/app/seller-register/page.tsx` — Complete 5-step seller registration UI (Phone/OTP, Business, Address, Bank, Documents) with handleComplete() wired
- `web/src/app/checkout/page.tsx` — Full Razorpay checkout: order placement → Razorpay modal → payment confirmation
- `web/src/app/listings/[id]/page.tsx` — Lot calculator + sector-specific fields + escrow info box already built
- `notification-service/src/services/fcm.ts` — Firebase Admin SDK FCM fully implemented
- `notification-service/src/services/whatsapp.ts` — Twilio WhatsApp with Hindi templates fully implemented
- `notification-service/src/queue/processor.ts` — Bull queue with retry, FCM + WhatsApp wired
- `analytics-service/src/routes/adminStats.ts` — `/admin/stats/dashboard`, `/gmv`, `/alerts`, `/recent-transactions` all implemented
- `admin/src/lib/api.ts` — statsApi wired to admin stats endpoints
- `admin/src/app/(dashboard)/page.tsx` — Dashboard fully wired to statsApi
- `order-service/src/services/negotiation.ts` — Full negotiation flow (initiate, counter, accept, reject, 5-round limit)
- `order-service/src/services/auction.ts` — Full WebSocket auction (bids, anti-sniping, outbid notifications)

### What was actually built this session

#### Backend
| File | What |
|---|---|
| `packages/auth-service/src/routes/auth.ts` | Added `POST /auth/verify-bank` + `POST /auth/kyc-upload-url` + dev mock upload endpoint |
| `packages/notification-service/src/queue/processor.ts` | Fixed `u.full_name` → `u.name` column bug |
| `packages/order-service/src/index.ts` | Registered `negotiationRouter` at `/negotiations`, initialized WebSocket auction server at `/ws/auction` |
| `infra/migrations/002_missing_columns.sql` | Added: `users.fcm_token`, `users.last_active_at`, seller address fields, `listings.ai_urgency_score`, `listings.view_count`, `listings.auction_ends_at`, `negotiation_offers` table, `auction_bids` table, `saved_searches` table, `ai_credits_log` table, `referrals` table, `buyer_addresses` table, dispute evidence columns |

#### Frontend — Web
| File | What |
|---|---|
| `web/src/lib/api.ts` | Added `negotiationsApi` (makeOffer, counter, accept, reject, getMyNegotiations), `aiApi.generateCaption`, `aiApi.generateHook` |
| `web/src/components/MarketingPanel.tsx` | NEW — Full AI marketing panel slide-up: language/tone/platform selectors, AI caption generation, editable output, copy + share, watermark notice, hashtag display |
| `web/src/components/NegotiationModal.tsx` | NEW — Make Offer modal: amount input, AI fair price suggestion via `/ai/pricing/fair-offer`, message field, negotiation thread display, accept/reject/withdraw actions |
| `web/src/app/listings/[id]/page.tsx` | Added: `showMarketing` state + MarketingPanel mount, `showNegotiation` state + NegotiationModal mount, "Generate Marketing Content" button, "Make Offer" button alongside Buy Now, MessageCircle + Megaphone icon imports |

#### Frontend — Mobile
| File | What |
|---|---|
| `mobile/app/marketing.tsx` | NEW — Full AI marketing screen: language/tone/platform selectors, AI caption generation (with demo fallback), Share API integration |

---

## Session: 2026-05-31 — Earlier (UI sprint fixes)

### Token system fixes
- `packages/mobile/src/theme/tokens.ts` — Fixed wrong colors (forest green → buyer blue #2563eb / seller green #16a34a). Added buyer/seller token sets.
- `packages/mobile/src/theme/ThemeContext.tsx` — Added panel switching + AsyncStorage persistence + `primaryColor` export
- `packages/mobile/src/components/DealCard.tsx` — Updated to use `primaryColor` from context
- `packages/mobile/src/components/AgentFab.tsx` — Updated to use `primaryColor` from context
- `packages/mobile/src/screens/HomeScreen.tsx` — Updated to use `primaryColor`
- `packages/mobile/src/screens/OtpScreen.tsx` — Updated to use `primaryColor`
- `packages/mobile/src/screens/SellerDashboardScreen.tsx` — Updated to use `primaryColor`
- `web/tailwind.config.js` — Full rewrite: nm-* token naming, darkMode: 'class', seller tokens added
- `web/src/app/globals.css` — Full rewrite: CSS custom properties (`--nm-*`), buyer/seller `data-panel` switching, dark mode, nm-* component classes, legacy aliases
- `web/src/lib/theme.tsx` — NEW: ThemeContext for web (buyer/seller panel + dark mode, localStorage persistence, `data-panel` attribute on `<html>`)
- `web/src/app/layout.tsx` — Added ThemeProvider wrapper
- `web/src/components/Header.tsx` — Updated all classes to nm-*, added dark mode toggle (Sun/Moon), added seller badge in green
- `admin/src/app/globals.css` — Added CSS custom property layer (`--nm-*`)
- `admin/src/components/ThemeToggle.tsx` — NEW: Dark mode toggle button with localStorage persistence
- `admin/src/app/layout.tsx` — Removed hardcoded `className="dark"`
- `ai-service/app/services/provider.py` — NEW: Claude/OpenAI dual-provider abstraction (auto-selects based on which key is set)
- `ai-service/app/routers/pricing.py` — Refactored to use provider abstraction
- `ai-service/app/routers/marketing.py` — Refactored to use provider abstraction
- `ai-service/app/routers/listing.py` — Refactored to use provider abstraction
- `.env.example` — Clarified AI key usage (set either ANTHROPIC or OPENAI, both work)

### Mobile Expo Router setup (all new files)
- `mobile/app/_layout.tsx` — Root layout with ThemeProvider, GestureHandlerRootView, SafeAreaProvider
- `mobile/app/index.tsx` — Auth guard → splash or buyer/seller tabs
- `mobile/app/splash.tsx` — Routes SplashScreen component
- `mobile/app/login.tsx` — Full OTP login screen, panel-aware (blue/green), language toggle
- `mobile/app/(buyer)/_layout.tsx` — Buyer tab navigator (Deals, Search, Orders, Profile)
- `mobile/app/(buyer)/index.tsx` — Buyer home: AI match banner, deal feed, sector pills, voice mic, "Market" button per card
- `mobile/app/(seller)/_layout.tsx` — Seller tab navigator (Dashboard, Listings, Add Stock, Orders, Profile)
- `mobile/app/(seller)/index.tsx` — Seller dashboard: stats grid, AI pricing alert, recent orders, quick actions
- `mobile/app/(seller)/listings.tsx` — Seller listings: AI urgency bar per listing, status badges
- `mobile/app/(seller)/new-listing.tsx` — 6-step AI listing flow: prompt → category → pricing → preview
- `mobile/app/(seller)/orders.tsx` — Seller orders with Mark as Shipped action
- `mobile/app/(seller)/profile.tsx` — Seller profile: stats strip, menu items, logout

---

## Build Status as of 2026-05-31

| Layer | Built | Total | % |
|---|---|---|---|
| Backend services | 10/10 scaffolded, ~7 functional | 10 | 70% |
| AI service | 4/4 routers + provider abstraction | 4 | 100% |
| Admin frontend | 13/14 screens | 14 | 93% |
| Web frontend | 18/20 screens | 20 | 90% |
| Mobile frontend | 12/18 screens | 18 | 67% |
| AI frontend UIs | 2/6 (Marketing Panel + Agent FAB) | 6 | 33% |
| Infrastructure | 9/12 items | 12 | 75% |
| **Overall** | | | **~75%** |

---

## Next Session
Run `start Sprint 4` for: AI Listing 6-step flow, order tracking timeline, flash sale strip, QA.
