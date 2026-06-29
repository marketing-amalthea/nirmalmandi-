# NirmalMandi — Master Manual QA Test Checklist

> **What this is:** A complete, click-by-click test script for the live NirmalMandi app. A non-developer can follow it top to bottom and tick each box. Every item says *what to do* and *what you should see*.
>
> **Live URLs**
> - Buyer + Seller app: **https://nirmalmandi-web.vercel.app**
> - Admin console: **https://nirmalmandi-admin.vercel.app**
>
> **Test logins (demo)**
> | Role   | Email                          | Password     | Use on            |
> |--------|--------------------------------|--------------|-------------------|
> | Seller | `seller@nirmalmandi.demo`      | `Seller@2026`| web app           |
> | Buyer  | `buyer@nirmalmandi.demo`       | `Buyer@2026` | web app           |
> | Admin  | `admin@nirmalmandi.demo`       | `Admin@2026` | admin console     |
>
> **Legend**
> - `EXPECTED:` what you should see if it works.
> - `[BLOCKED: needs Razorpay keys]` — the real payment step cannot complete on the demo unless live Razorpay keys are configured. You can test everything up to the Razorpay popup.
> - `[BLOCKED: needs Resend/domain]` — depends on a configured email sender / production domain. The UI flow still works but no email actually arrives.
> - A "toast" is the small temporary message box that slides in (usually top or bottom of screen).
>
> **General tips**
> - Many pages need you to be logged in. If you get bounced to `/login`, log in first with the matching role.
> - Money is shown in Indian format (₹1,23,456). "GMV" = total sales value.
> - When a test says "loading spinner", you'll briefly see a spinning green circle.

---

# PORTAL 1 — PUBLIC VIEW (no login needed)

## Public — Homepage
URL: `https://nirmalmandi-web.vercel.app/`
Pre-condition: None. Open in a fresh browser / incognito (logged out).

### Data loading
- [ ] Hero section loads — EXPECTED: dark green banner with headline "Dead inventory, turned into cash.", an "India's B2B liquidation mandi" pill, and 3 stats: "₹240Cr+ GMV liquidated", "12,400+ live lots", "74% avg capital recovered".
- [ ] Flash sales section loads — EXPECTED: heading "🔥 Flash sales" with a live ticking countdown timer (HH:MM:SS counting down each second), and up to 4 product cards. While loading you see 4 grey shimmer placeholder cards.
- [ ] Featured deals grid loads — EXPECTED: heading "Featured deals" with up to 8 product cards showing image/title/price. (If the inventory service has no listings, cards may be empty — that is acceptable, page must not crash.)
- [ ] AI match banner (logged-in buyers only) — STEPS: log in as buyer, return to `/`. EXPECTED: if you have matched deals, a green "✨ N deals matched for you today" bar appears at the very top with a "See your deals →" button. Logged out, this bar is absent.

### Interactions
- [ ] Sector chips — STEPS: click any sector chip (e.g. "Electronics"). EXPECTED: navigates to `/listings?sector=Electronics`, that sector pre-selected.
- [ ] "Sell Now" button (hero) — STEPS: click. EXPECTED: goes to `/seller-register`.
- [ ] "Browse Deals" button (hero) — STEPS: click. EXPECTED: goes to `/listings`.
- [ ] Flash "View all →" link — STEPS: click. EXPECTED: goes to `/listings?price_type=flash_sale`.
- [ ] Seller CTA "List your inventory" — STEPS: scroll to green "Sitting on dead stock?" card, click button. EXPECTED: goes to `/seller-register`.
- [ ] Any product card — STEPS: click a card. EXPECTED: opens that listing's detail page `/listings/[id]`.
- [ ] Top nav links work (logo, Browse, login/account) — EXPECTED: each navigates correctly.

### Edge cases
- [ ] Inventory service down/empty — EXPECTED: page still renders hero + footer, grids just show empty or skeletons; no white crash screen.
- [ ] Footer present — EXPECTED: "© 2026 NirmalMandi · Escrow by RazorpayX · Logistics by Delhivery".

---

## Public — Listings Marketplace
URL: `https://nirmalmandi-web.vercel.app/listings`
Pre-condition: None.

### Data loading
- [ ] Listings load — EXPECTED: "All deals" heading, a count like "N lots", and a 3-column grid of product cards. While loading, 12 grey skeleton cards show.
- [ ] Lot count matches — EXPECTED: the "N lots" figure reflects total available listings.

### Interactions
- [ ] Search box — STEPS: type a product/brand keyword. EXPECTED: after ~0.4s pause, grid refreshes to matching lots; result count updates. An "✕" clear button appears inside the box.
- [ ] Clear search — STEPS: click the ✕ in the search box. EXPECTED: search empties and full list returns.
- [ ] Price min/max filter — STEPS: enter Min and/or Max price in the left sidebar. EXPECTED: results narrow to that price band (filter applies on next list refresh / interaction).
- [ ] Sector checkboxes — STEPS: tick one or more sectors (e.g. Electronics, FMCG). EXPECTED: grid filters to those sectors; resets to page 1.
- [ ] Condition grade checkboxes (A/B/C/Scrap) — STEPS: tick a grade. EXPECTED: grid filters to that grade.
- [ ] Stock type checkboxes (Dead/Excess/Surplus/Returns) — STEPS: tick one. EXPECTED: grid filters.
- [ ] Lot type checkboxes (Full/Partial) — STEPS: tick one. EXPECTED: grid filters.
- [ ] Sort tabs — STEPS: click "Newest", "Price Low→High", "Most viewed", "Ageing first" one by one. EXPECTED: card order changes accordingly; resets to page 1.
- [ ] "Clear" filters — STEPS: with filters active, click "Clear" in sidebar header. EXPECTED: all filters/search reset, URL becomes `/listings`, full list reloads.
- [ ] Compare — STEPS: tick the "Compare" checkbox on 2-3 cards. EXPECTED: a gold "Compare (N)" tab appears; clicking it opens a compare drawer showing the selected lots side by side.
- [ ] Compare max 3 — STEPS: try to tick a 4th card. EXPECTED: error toast "Max 3 listings for comparison".
- [ ] Pagination — STEPS: if more than 12 lots, click page numbers / "Next" / "Prev". EXPECTED: grid updates, page scrolls to top, current page highlighted. Prev disabled on page 1, Next disabled on last page.
- [ ] Card click — STEPS: click any card body. EXPECTED: opens `/listings/[id]`.

### Edge cases
- [ ] No results — STEPS: search gibberish like "zzzzqqqq". EXPECTED: empty-state card "No deals found matching your filters" with a "Clear all filters" button.
- [ ] Deep link with sector — STEPS: open `/listings?sector=FMCG`. EXPECTED: FMCG pre-checked and filtered.

---

## Public — Listing Detail
URL: `https://nirmalmandi-web.vercel.app/listings/[id]` (click any card to get a real id)
Pre-condition: A live listing must exist.

### Data loading
- [ ] Listing details render — EXPECTED: title, big price per unit (₹), MRP struck-through (if set), sector pill, condition grade pill, seller business name, seller city/state, available units, stock type.
- [ ] Image gallery — EXPECTED: main image shows; if multiple images, up to 4 thumbnails below. If no image, a package placeholder icon shows.
- [ ] Lot specifications — EXPECTED: if the lot has attributes, a "Lot specifications" panel lists them as key/value pairs.
- [ ] Discount / flash badges — EXPECTED: if MRP > price, a "−N%" gold badge; if flash sale, a "🔥 Flash" red badge.
- [ ] Lot calculator — EXPECTED: a gold box "Lot calculator" with quantity stepper, Subtotal, Platform fee 2.5%, "You pay" total, and an est. resale margin line.

### Interactions
- [ ] Thumbnail switch — STEPS: click a thumbnail. EXPECTED: main image swaps; selected thumbnail gets a green border.
- [ ] Quantity stepper − / + — STEPS: click minus and plus. EXPECTED: quantity changes (respects MOQ minimum and available max); Subtotal / You pay / margin all recompute live.
- [ ] Quantity typing — STEPS: type a number in the quantity field. EXPECTED: clamps between MOQ and available qty.
- [ ] "Buy now" (logged out) — STEPS: click Buy now while logged out. EXPECTED: redirects to `/login`.
- [ ] "Buy now" (logged in as buyer) — STEPS: log in as buyer, click Buy now. EXPECTED: goes to `/checkout?listing_id=...&quantity=...`.
- [ ] "Buy now" disabled — EXPECTED: button is disabled if listing status is not "live"/"active".
- [ ] "Make offer" (logged out) — STEPS: click. EXPECTED: redirects to `/login`.
- [ ] "Make offer" (logged in) — STEPS: click. EXPECTED: a negotiation modal opens; accepting an agreed price routes to checkout with the agreed price.
- [ ] Watchlist heart (logged out) — STEPS: click the heart. EXPECTED: error toast "Login to save listings" then redirect to `/login`.
- [ ] Watchlist heart (logged in) — STEPS: log in as buyer, click heart. EXPECTED: toast "Saved to watchlist", heart fills red. Click again → "Removed from watchlist", heart empties.
- [ ] "Request Bulk Quote (RFQ)" — STEPS: click. EXPECTED: an RFQ modal opens.
- [ ] AI WhatsApp caption — STEPS: scroll to "AI MARKET-IT", click "WhatsApp caption". EXPECTED: spinner, then a Hindi/urgent caption appears in the preview box on the right.
- [ ] AI Instagram caption — STEPS: click "📸 Instagram". EXPECTED: a caption appears in the preview box.
- [ ] "More options" — STEPS: click. EXPECTED: marketing panel modal opens.
- [ ] Back link — STEPS: click "Back to listings". EXPECTED: returns to `/listings`.

### Edge cases
- [ ] Bad id — STEPS: open `/listings/nonexistent`. EXPECTED: "Listing not found" with a "Browse all listings" button.
- [ ] Compliance warning (buyers) — EXPECTED: for restricted goods, a gold "Compliance Required" banner may appear with a warning message.
- [ ] Caption AI failure — EXPECTED: if AI service errors, toast "Caption generation failed"; page stays usable.

---

# PORTAL 2 — SELLER PORTAL
App: `https://nirmalmandi-web.vercel.app`

## Seller — Login
URL: `/login`
Pre-condition: Logged out.

### Data loading
- [ ] Page renders — EXPECTED: left dark panel "Welcome back to the mandi." with 3 stats; right side a "Sign in" form (email + password).

### Interactions
- [ ] Show/hide password — STEPS: type a password, click the eye icon. EXPECTED: toggles between dots and plain text.
- [ ] Empty submit — STEPS: click "Sign in →" with blank fields. EXPECTED: error toast "Enter email and password".
- [ ] Valid seller login — STEPS: enter `seller@nirmalmandi.demo` / `Seller@2026`, submit. EXPECTED: toast "Welcome back, [name]!", redirect to `/seller/dashboard`.
- [ ] Register links — STEPS: click "Register as seller" / "Register as buyer". EXPECTED: go to `/seller-register` / `/register`.
- [ ] Forgot password link — STEPS: click "Forgot password?". EXPECTED: go to `/forgot-password`.

### Edge cases
- [ ] Wrong password — STEPS: enter a wrong password. EXPECTED: red error toast "Invalid email or password" (or server message).

---

## Seller — Register
URL: `/seller-register`
Pre-condition: Logged out. Use a NEW email you have not registered before.

### Data loading
- [ ] Page renders — EXPECTED: left panel "Turn dead stock into working capital." with benefits list; right "Start selling" form (name, email, password) and a "What happens next" card.

### Interactions
- [ ] Empty submit — STEPS: submit blanks. EXPECTED: toast "All fields required".
- [ ] Short password — STEPS: enter a password under 6 chars. EXPECTED: toast "Password must be at least 6 characters".
- [ ] Successful register — STEPS: fill name/email/new-password, submit. EXPECTED: toast "Account created! Complete your profile to unlock payouts.", redirect to `/seller/dashboard`.
- [ ] Show/hide password eye works.

### Edge cases
- [ ] Duplicate email — STEPS: register with an email already in use. EXPECTED: toast "Email already registered — sign in instead."
- [ ] Server error — EXPECTED: toast showing status + message.

---

## Seller — Dashboard
URL: `/seller/dashboard`
Pre-condition: Logged in as seller.

### Data loading
- [ ] Greeting header — EXPECTED: "Good morning, [first name]" with business name · city subtitle.
- [ ] KPI cards (4) — EXPECTED: "GMV this month", "Pending payout" (with expected payout date), "Active listings", "Awaiting action". Values come from `/api/seller/dashboard`.
- [ ] Capital recovery card — EXPECTED: a waterfall: Gross sales (GMV) → minus Platform fee 2.5% → minus GST on fee 18% → green "Net payout" total.
- [ ] Recent orders table — EXPECTED: up to 6 recent orders (Order / Item / Buyer / Amount / Status). If none, "No orders yet." with an icon.

### Interactions
- [ ] Onboarding banner — EXPECTED: if business name not set or no active listings, a green "Complete your seller profile to unlock payouts" banner with "Complete profile →" → `/seller/profile`.
- [ ] Aging alert — EXPECTED: if listings aged 30+ days, a gold banner "N listings haven't sold in 30+ days" with "Review →" → `/seller/listings`.
- [ ] Shipment alert — EXPECTED: if orders awaiting shipment, a blue banner with "View orders →" → `/seller/orders`.
- [ ] "New listing" button (header) — STEPS: click. EXPECTED: goes to `/seller/listings/new`.
- [ ] Recent order row click — STEPS: click a row. EXPECTED: navigates to `/seller/orders`.
- [ ] Quick actions — STEPS: click "Add listing" / "View all orders" / "Check payouts". EXPECTED: route to new listing / orders / payouts.
- [ ] "View all →" on recent orders — EXPECTED: goes to `/seller/orders`.

### Edge cases
- [ ] Data fetch fails — EXPECTED: error toast "Failed to load dashboard data"; KPIs fall back to zeros, page still renders.

---

## Seller — My Listings
URL: `/seller/listings`
Pre-condition: Logged in as seller (ideally with ≥1 listing — create one first via New Listing if empty).

### Data loading
- [ ] Stats row — EXPECTED: 4 stat cards: Total listings, Live, Paused, Views (this page).
- [ ] Listings table — EXPECTED: rows with thumbnail+title, Asking price, Status badge, Views, Watching, Age (in days, red if ≥30), and Actions. Loading shows a spinner.

### Interactions
- [ ] Search — STEPS: type in "Search listings…". EXPECTED: after ~0.3s, table filters; resets to page 1.
- [ ] Status tabs — STEPS: click All / Live / Paused / Sold / Expired / Flagged. EXPECTED: table filters to that status.
- [ ] Sort dropdown — STEPS: click the sort button, pick "Most views" / "Newest" / "Price high-low" / "Oldest". EXPECTED: rows reorder; dropdown closes.
- [ ] Edit link — STEPS: click "Edit" on a row. EXPECTED: opens `/seller/listings/[id]/edit`.
- [ ] Pause/Resume toggle — STEPS: flip the toggle on a Live or Paused listing. EXPECTED: brief spinner then toast "Listing paused" or "Listing resumed"; status updates after refresh.
- [ ] Delete — STEPS: click the red trash icon. EXPECTED: a browser confirm "Delete "[title]"?…". Confirm → toast "Listing deleted", row disappears. Cancel → nothing happens.
- [ ] "New listing" button — STEPS: click. EXPECTED: goes to `/seller/listings/new`.
- [ ] Pagination — STEPS: with >20 listings, use page buttons. EXPECTED: table updates; current page highlighted; Prev/Next disabled at ends.

### Edge cases
- [ ] Empty state — EXPECTED: when no listings match, "No [status] listings found" with a "New listing" button.
- [ ] Toggle failure — EXPECTED: toast "Failed to update listing status"; state unchanged.
- [ ] Delete failure — EXPECTED: toast "Failed to delete listing".

---

## Seller — New Listing
URL: `/seller/listings/new`
Pre-condition: Logged in as seller.

### Data loading
- [ ] Form renders — EXPECTED: collapsible "AI listing assistant" at top, then sections: Basics, Pricing & quantity, Photos, Location, Urgency, plus a GSTIN note.
- [ ] Category dropdown populated — EXPECTED: category select lists sectors (falls back to a built-in list if the service is empty).

### Interactions — AI assistant
- [ ] Open AI panel — STEPS: click "AI listing assistant" header (▼ Open). EXPECTED: panel expands with a text box.
- [ ] Fill with AI — STEPS: type something like "Mere paas 500 shirts hain size M L XL, Surat godown mein, 3 saal se nahi bike", click "Fill form with AI". EXPECTED: spinner "Analyzing…", then toast "AI extracted listing details. Review and confirm below.", and form fields (title, description, stock type, grade, quantity, unit, price, MRP, possibly category) auto-fill. A chat bubble shows the AI's reply.
- [ ] AI error handling — EXPECTED: if AI fails, toast "AI error …" with status/message; form unaffected.

### Interactions — form fields
- [ ] Title — typing works; max 500 chars.
- [ ] Description — typing works; max 2000 chars.
- [ ] Category select — choosing a value works.
- [ ] Stock type select (Overstock/Returns/Seasonal/Obsolete/Near Expiry/Damaged Packaging) — works.
- [ ] Price type select (Fixed/Best offer/Auction/Flash sale) — works; choosing "Best offer" reveals a "Floor price" field.
- [ ] Asking price / MRP — numeric entry.
- [ ] Total quantity / Unit / MOQ — entry; unit dropdown options present.
- [ ] Condition grade chips (A/B/C/D) — clicking selects (green highlight).
- [ ] Lot type select (Full lot / Partial / Per unit) — works.
- [ ] Location: State dropdown + City + Pincode (digits only, max 6).
- [ ] Urgency selector — STEPS: click numbers 1–5. EXPECTED: selected number highlights gold; label below updates (5 shows 🔥 "eligible for flash sale").

### Interactions — photos
- [ ] Upload by click — STEPS: click the drop zone, pick a JPG/PNG/WebP under 5MB. EXPECTED: thumbnail appears with an upload progress overlay, then a green check when done. First photo is tagged "COVER".
- [ ] Drag & drop — STEPS: drag image files onto the zone. EXPECTED: same upload behaviour; zone highlights green while dragging.
- [ ] Bad format — STEPS: try a non-image (e.g. .txt). EXPECTED: toast "[name]: unsupported format".
- [ ] Too big — STEPS: try an image >5MB. EXPECTED: toast "[name]: exceeds 5MB limit".
- [ ] Max 20 — STEPS: add many images. EXPECTED: warns "Only N more image(s) can be added (max 20)"; counter shows "x/20".
- [ ] Remove image — STEPS: click the red ✕ on a thumbnail. EXPECTED: image removed.
- [ ] Retry failed upload — EXPECTED: if an upload errors, a "Retry" button appears on the thumbnail. (Note: when S3 isn't configured, the app falls back to a local preview and still marks the photo "done" so submission works.)

### Interactions — submit
- [ ] Validation — STEPS: click "Publish" with required fields empty. EXPECTED: toast "Please fix the highlighted fields"; each missing field shows a red inline error (Title ≥5 chars, Category, Stock type, Grade, Lot type, Quantity, Asking price, State, City; MOQ required for partial/per_unit; Floor < Asking for Best offer; pincode 6 digits when used).
- [ ] Wait for uploads — STEPS: click Publish while a photo is still uploading. EXPECTED: toast "Please wait for all photos to finish processing".
- [ ] Successful publish — STEPS: fill all required, click "Publish". EXPECTED: toast "Listing is live!", redirect to `/seller/listings` where the new listing appears.
- [ ] Save draft — STEPS: click "Save draft". EXPECTED: toast "Draft saved" (saved to browser local storage).

### Edge cases
- [ ] Create failure — EXPECTED: toast "Failed to create listing (status): message".

---

## Seller — Edit Listing
URL: `/seller/listings/[id]/edit` (open via "Edit" on My Listings)
Pre-condition: Logged in as seller; listing belongs to you.

### Data loading
- [ ] Pre-filled form — EXPECTED: Basics (title, description, stock type, price type), Pricing (asking/floor/MRP), Stock details (grade chips, lot type, unit, MOQ), Location (state/city), Urgency, and a "Listing status" card all pre-populated from the existing listing.

### Interactions
- [ ] Edit fields — STEPS: change title, price, etc. EXPECTED: fields update.
- [ ] Save changes — STEPS: click "Save changes". EXPECTED: validates (Title ≥5, Asking>0, State, City); on success toast "Listing updated!", redirect to `/seller/listings`.
- [ ] Validation fail — STEPS: clear title or asking price, save. EXPECTED: toast "Fix the highlighted fields" with red inline errors.
- [ ] Pause/Go-live toggle (header) — STEPS: click "Pause" (if live) or "Go live" (if paused). EXPECTED: toast "Listing paused" / "Listing is live"; the status pill in the status card flips between "● Live" and "⏸ Paused".
- [ ] Status card button — STEPS: click "Pause listing"/"Go live" in the status card. EXPECTED: same toggle behaviour.
- [ ] Back button — STEPS: click "Back". EXPECTED: returns to `/seller/listings`.

### Edge cases
- [ ] Not your listing / bad id — EXPECTED: "Listing not found or you don't have access." with "Back to listings".
- [ ] Save failure — EXPECTED: toast "Failed to update listing".
- [ ] Toggle failure — EXPECTED: status reverts; toast "Failed to update status".

---

## Seller — Orders
URL: `/seller/orders`
Pre-condition: Logged in as seller. To test "Mark shipped" you need at least one order in a paid/confirmed state (depends on a completed checkout — see Buyer Checkout, `[BLOCKED: needs Razorpay keys]`).

### Data loading
- [ ] KPI cards (4) — EXPECTED: Total orders, Pending payment, In transit, Completed (computed from your orders).
- [ ] Orders list — EXPECTED: each order shows thumbnail, listing title, "#order · buyer · qty · time ago", a "View details" link, status badge, amount, and a context button.

### Interactions
- [ ] Status tabs — STEPS: click All / Awaiting Payment / Active / Shipped / Completed / Disputed. EXPECTED: list filters by the matching backend statuses.
- [ ] Search by order # — STEPS: type into the search box. EXPECTED: list filters by order number / listing / buyer.
- [ ] "View details" / "View order" — STEPS: click. EXPECTED: opens `/orders/[id]`.
- [ ] Mark shipped (shippable order) — STEPS: on an order in paid/confirmed state click "Mark shipped". EXPECTED: a modal "Mark as shipped" opens.
- [ ] Mark shipped modal validation — STEPS: submit with blanks. EXPECTED: inline errors "Tracking number is required" and "Please select a courier".
- [ ] Mark shipped submit — STEPS: enter tracking number, pick a courier (Delhivery/BlueDart/DTDC/Ekart/India Post/Other), click "Mark shipped". EXPECTED: toast "Order marked as shipped", modal closes, list refreshes.
- [ ] Pagination — STEPS: with >20 orders, use page controls. EXPECTED: list updates.

### Edge cases
- [ ] No orders — EXPECTED: "No orders found." with an icon.
- [ ] Ship failure — EXPECTED: toast "Failed to mark order as shipped".

---

## Seller — Payouts
URL: `/seller/payouts`
Pre-condition: Logged in as seller.

### Data loading
- [ ] KPI cards (4) — EXPECTED: Total earned, In escrow (with N orders held), Processing, Pending.
- [ ] Escrow summary — EXPECTED: 3 tiles: Held in escrow (₹ + count), Released (₹ + count), In dispute (₹ + count).
- [ ] Payout history table — EXPECTED: columns Order, Listing, Gross, Commission, TCS, Net payout, Status, Scheduled for. Money columns formatted; commission/TCS shown as negatives.

### Interactions
- [ ] Status filter tabs — STEPS: click All / Scheduled / Processing / Completed / Held. EXPECTED: table filters by status.
- [ ] Order link — STEPS: click an order number in the table. EXPECTED: opens `/orders/[order_id]`.
- [ ] Pagination — STEPS: with >20 payouts, use "‹ N / M ›". EXPECTED: page changes.

### Edge cases
- [ ] No payouts — EXPECTED: "No payouts yet" with "Browse listings" CTA.
- [ ] Filter with no matches — EXPECTED: "No payouts match this filter."
- [ ] Payout fetch fails — EXPECTED: toast "Failed to load payout data".

---

## Seller — Analytics
URL: `/seller/analytics`
Pre-condition: Logged in as seller.

### Data loading
- [ ] KPI cards (4) — EXPECTED: Revenue (with % change), Orders (with % change), CVR (conversion %), Avg response.
- [ ] Revenue trend chart — EXPECTED: a green area chart (uses a fallback curve if no data).
- [ ] Conversion funnel — EXPECTED: horizontal bars: Views, Inquiries, Orders, Repeat.
- [ ] Top listings table — EXPECTED: Listing / Views / Inquiries / Orders / Revenue. If none, "No listing data for this period".
- [ ] AI Insights panel — EXPECTED: a dark "AI Insights" card with 3 rule-based bullet recommendations and an "Ask Claude" button.

### Interactions
- [ ] Period tabs — STEPS: click 30d / 90d / 6m / 1y. EXPECTED: all data refetches for that window.
- [ ] "Ask Claude" — STEPS: click the "Ask Claude" button in AI Insights. EXPECTED: "Claude is analysing your data…", then an AI-written paragraph appears below the bullets. If it fails, "Could not load AI analysis right now."

### Edge cases
- [ ] Analytics fetch fails — EXPECTED: toast "Failed to load analytics data"; zeros shown.

---

## Seller — KYC
URL: `/seller/kyc`
Pre-condition: Logged in as seller.

### Data loading
- [ ] Status banner — EXPECTED: an icon + label reflecting KYC status: "Pending review" / "Under review" / "KYC verified" / "KYC rejected", with explanatory text. If rejected, shows the rejection reason and a "Contact support to resubmit" mailto link.
- [ ] Documents checklist — EXPECTED: 4 rows (GST Certificate, PAN Card, Bank Account Proof, Business Address Proof) each marked "On file" (green check) or "Needed" based on your profile data.
- [ ] Verification tiers — EXPECTED: 3 tier cards (Basic, Verified, Premium) listing unlocks; the current tier is highlighted and labelled "Current".

### Interactions
- [ ] "Go to Profile to add documents" link — STEPS: click. EXPECTED: navigates to `/seller/profile`.
- [ ] Support email links — STEPS: click "Email support@nirmalmandi.com" / resubmit mailto. EXPECTED: opens email client to support@nirmalmandi.com.

### Edge cases
- [ ] Not logged in — EXPECTED: redirected to `/login`.

---

## Seller — Notifications
URL: `/seller/notifications`
Pre-condition: Logged in as seller.

### Data loading
- [ ] List loads — EXPECTED: notifications with an icon (by type), title, body, and time-ago. Unread items have a green-tinted background and a green dot.
- [ ] Unread count in header — EXPECTED: title shows "Notifications (N unread)" when there are unread items.

### Interactions
- [ ] Type tabs — STEPS: click All / Orders / Payments / Disputes / Listings. EXPECTED: list filters by type.
- [ ] Mark one read — STEPS: click an unread notification. EXPECTED: it loses the green highlight/dot (marked read).
- [ ] "Mark all read" — STEPS: click the header button (only present when unread > 0). EXPECTED: toast "All notifications marked as read"; all highlights clear.

### Edge cases
- [ ] Empty — EXPECTED: "No notifications yet" empty state.
- [ ] Mark all fails — EXPECTED: toast "Failed to mark all read".

---

## Seller — Profile
URL: `/seller/profile`
Pre-condition: Logged in as seller.

### Data loading
- [ ] Header card — EXPECTED: avatar (business initials), business name, member-since date, KYC status pill, seller tier pill, and stats (Listings / Orders / Rating).
- [ ] Business details card — EXPECTED: Business name, Business type, GSTIN, PAN (masked ••••XXXX), MSME number, Language.
- [ ] Location & contact card — EXPECTED: State, City, Address, Pincode, Phone, Email.
- [ ] Bank account card — EXPECTED: masked account last4 and IFSC, with "Contact support to update" pill.
- [ ] Reseller Storefront card — EXPECTED: an enable toggle, URL slug field, tagline, and a reseller margin slider.

### Interactions
- [ ] Edit profile — STEPS: click "Edit profile". EXPECTED: name + business fields + location fields become editable inputs/selects; Save/Cancel buttons appear.
- [ ] Save changes — STEPS: change a field (e.g. city), click "Save changes". EXPECTED: spinner "Saving…", toast "Profile updated", returns to read-only with new value.
- [ ] Cancel edit — STEPS: click "Cancel". EXPECTED: edits discarded, back to read-only.
- [ ] Storefront enable toggle — STEPS: flip the toggle. EXPECTED: toggle changes state (saved on "Save storefront settings").
- [ ] Storefront slug — STEPS: type a slug (auto-lowercases, strips invalid chars). EXPECTED: a "Preview storefront" link `/s/[slug]` appears.
- [ ] Reseller margin slider — STEPS: drag the slider 0–50%. EXPECTED: the "Reseller margin: N%" label updates live.
- [ ] Save storefront — STEPS: click "Save storefront settings". EXPECTED: toast "Storefront settings saved".

### Edge cases
- [ ] Save profile fails — EXPECTED: toast "Failed to update profile".
- [ ] Save storefront fails — EXPECTED: toast "Failed to save storefront settings".

---

## Seller — Settings
URL: `/seller/settings`
Pre-condition: Logged in as seller.

### Data loading
- [ ] Notification preferences — EXPECTED: 3 toggles: Order updates, Payment notifications, Dispute alerts (default on).
- [ ] Business settings (read-only) — EXPECTED: Business name, GST number, Bank account (masked), IFSC, with a "Contact support to update" note.

### Interactions
- [ ] Toggle a preference — STEPS: flip any notification toggle. EXPECTED: toast "Preferences saved" (saves via `/api/profile/me`). If it fails, it reverts and shows "Failed to save preferences".
- [ ] Change password — STEPS: click "Change password", enter current + new (≥8) + confirm, click "Update password". EXPECTED: toast "Password changed", form collapses.
- [ ] Password mismatch — STEPS: make new ≠ confirm. EXPECTED: toast "Passwords do not match".
- [ ] Password too short — STEPS: new < 8 chars. EXPECTED: toast "New password must be at least 8 characters".
- [ ] Pause all listings — STEPS: in Danger zone click "Pause all", then "Yes, pause all" in the dialog. EXPECTED: toast "Paused N listings" (or "All listings paused"); dialog closes. Cancel/✕ closes without action.

### Edge cases
- [ ] Change password wrong current — EXPECTED: toast with server error (e.g. "Failed to change password").
- [ ] Pause all fails — EXPECTED: toast "Failed to pause listings. Please try again or contact support."

---

## Seller — Forgot Password
URL: `/forgot-password`
Pre-condition: Logged out.

### Interactions
- [ ] Empty submit — STEPS: click "Send reset link" with blank email. EXPECTED: toast "Enter your email address".
- [ ] Submit email — STEPS: enter an email, submit. EXPECTED: spinner "Sending…", then a "Check your email" success card naming your email. `[BLOCKED: needs Resend/domain]` — no real email arrives unless email sender is configured.
- [ ] Back to login — STEPS: click "Back to login" / "Back to login" button. EXPECTED: goes to `/login`.

### Edge cases
- [ ] Unknown email — EXPECTED: still shows success screen (intentional, to not reveal whether the email exists).

---

## Seller/Buyer — Change Password
URL: `/change-password`
Pre-condition: Logged in (seller or buyer).

### Interactions
- [ ] Form renders — EXPECTED: Current / New / Confirm password fields, each with a show/hide eye.
- [ ] Mismatch — STEPS: new ≠ confirm, submit. EXPECTED: toast "Passwords do not match".
- [ ] Too short — STEPS: new < 8, submit. EXPECTED: toast "New password must be at least 8 characters".
- [ ] Success — STEPS: enter valid current + matching new (≥8), submit. EXPECTED: toast "Password changed successfully", redirect to `/seller/profile` (seller) or `/profile` (buyer).
- [ ] Back link — STEPS: click "Back". EXPECTED: returns to settings/profile by role.

### Edge cases
- [ ] Wrong current password — EXPECTED: toast with server error message.
- [ ] Not logged in — EXPECTED: redirected to `/login`.

---

# PORTAL 3 — BUYER PORTAL
App: `https://nirmalmandi-web.vercel.app`
Login: `buyer@nirmalmandi.demo` / `Buyer@2026`

## Buyer — Register
URL: `/register`
Pre-condition: Logged out; use a fresh email.

### Interactions
- [ ] Empty submit — EXPECTED: toast "All fields required".
- [ ] Short password — EXPECTED: toast "Password must be at least 6 characters".
- [ ] Success — STEPS: fill name/email/password, submit. EXPECTED: toast "Welcome, [name]!", redirect to `/dashboard`.
- [ ] Links — "Sign in" → `/login`, "Register as seller" → `/seller-register`.

### Edge cases
- [ ] Duplicate/error — EXPECTED: toast "Registration failed" or server message.

---

## Buyer — Dashboard
URL: `/dashboard`
Pre-condition: Logged in as buyer.

### Data loading
- [ ] Greeting — EXPECTED: "Welcome back, [name]" with city subtitle.
- [ ] KPI cards (4) — EXPECTED: Total orders (with "+N this week"), Total spent, Pending, Delivered (with on-time %).
- [ ] Recent orders table — EXPECTED: up to 8 orders with Order / Item / Qty / Amount / Escrow (Holding/Released) / Status / Date. If none, "No orders yet. Browse deals…".

### Interactions
- [ ] Phone verification widget — EXPECTED: for email/Google signups without a phone, a verification widget appears; verifying reloads the page.
- [ ] "Browse inventory" — STEPS: click. EXPECTED: goes to `/listings`.
- [ ] Notifications bell — STEPS: click. EXPECTED: goes to `/notifications`.
- [ ] Order row click — STEPS: click a row. EXPECTED: opens `/orders/[id]`.
- [ ] "View all →" — EXPECTED: goes to `/orders`.

### Edge cases
- [ ] Not logged in — EXPECTED: redirected to `/login`.

---

## Buyer — Browse (Listings)
URL: `/listings`
Pre-condition: None (same page as Public Marketplace). Logged in shows watchlist/buy capabilities.
- [ ] (Re-run the **Public — Listings Marketplace** checks above while logged in as buyer.)
- [ ] Card watchlist heart (if shown on cards) — EXPECTED: toggling works without forcing login.

---

## Buyer — Listing Detail
URL: `/listings/[id]`
Pre-condition: Logged in as buyer.
- [ ] (Re-run **Public — Listing Detail** while logged in.)
- [ ] Buy now — STEPS: click. EXPECTED: goes directly to `/checkout?listing_id=...&quantity=...` (no login bounce).
- [ ] Watchlist heart — STEPS: click. EXPECTED: toast "Saved to watchlist" / "Removed from watchlist"; heart fills/empties.
- [ ] Seller info shows — EXPECTED: seller business name + city/state under the title.

---

## Buyer — Checkout
URL: `/checkout?listing_id=[id]&quantity=[n]` (reach it via Buy now)
Pre-condition: Logged in as buyer; a valid listing id in the URL.

### Data loading
- [ ] Order summary — EXPECTED: product mini-card (image, title, seller, grade), then line items: Subtotal (qty × unit), Platform fee 2.5%, GST on fee 18%, Freight, and a Total. An escrow note appears.
- [ ] Addresses load — EXPECTED: your saved addresses listed as selectable radio options; first is preselected. If none, only "Add new address" shows.

### Interactions
- [ ] Select saved address — STEPS: click a saved address radio. EXPECTED: it highlights green and becomes the delivery address.
- [ ] Add new address — STEPS: choose "Add new address". EXPECTED: a form appears (name, phone, line1, line2, city, pincode, state, save-for-future checkbox).
- [ ] New address validation — STEPS: try to pay with invalid fields. EXPECTED: toasts for: "Name is required", "Enter a valid 10-digit mobile number", "Address Line 1 is required", "City is required", "State is required", "Enter a valid 6-digit pincode".
- [ ] Freight options — STEPS: pick a freight option (Platform logistics / Seller ship / Buyer pickup). EXPECTED: Seller/Buyer = "Free"; Platform logistics triggers a freight estimate (shows "Calculating…" then a cost or "Unavailable"). Total updates to include freight.
- [ ] Freight required — STEPS: try to pay without selecting freight. EXPECTED: toast "Please select a freight option".
- [ ] Tier gate (high value) — EXPECTED: for totals ≥ ₹1,00,000 a gold "High-value order verification" note appears; clicking Pay opens a Tier-2 (≥₹1L) or Tier-3 (≥₹10L) verification modal before payment.
- [ ] Pay button — STEPS: with address + freight selected, click "Pay ₹… securely". EXPECTED: order is created, then the **Razorpay payment popup** opens. `[BLOCKED: needs Razorpay keys]` — completing the actual payment requires live Razorpay keys; on success it routes to `/orders/[id]?paid=true`.
- [ ] Back to listing — STEPS: click "Back to listing". EXPECTED: returns to `/listings/[id]`.

### Edge cases
- [ ] Not logged in — EXPECTED: toast "Please login to checkout", redirect to `/login`.
- [ ] Bad listing id — EXPECTED: "Listing not found" with "Browse listings".
- [ ] Payment gateway not loaded — EXPECTED: toast "Payment gateway is loading. Please try again."
- [ ] Freight estimate fails — EXPECTED: toast "Could not estimate freight. Please try again."; Pay stays disabled for platform logistics until a cost is returned.

---

## Buyer — Orders
URL: `/orders`
Pre-condition: Logged in as buyer.

### Data loading
- [ ] Orders list — EXPECTED: cards with thumbnail, listing title, "#order · qty · ordered time-ago", an "In escrow" chip where applicable, amount, status badge, and a chevron.

### Interactions
- [ ] Status tabs — STEPS: click All / Pending payment / Paid / Shipped / Delivered / Completed / Disputed. EXPECTED: list filters by status; resets to page 1.
- [ ] Search — STEPS: type a term and press Enter. EXPECTED: list filters by search.
- [ ] Order click — STEPS: click a card. EXPECTED: opens `/orders/[id]`.
- [ ] Export CSV button — STEPS: click. EXPECTED: button is present (cosmetic; may not download in demo).
- [ ] Pagination — STEPS: with >15 orders, use page buttons. EXPECTED: list updates.

### Edge cases
- [ ] No orders — EXPECTED: "No [status] orders yet." empty state.
- [ ] Not logged in — EXPECTED: redirected to `/login`.

---

## Buyer — Order Detail
URL: `/orders/[id]`
Pre-condition: Logged in as buyer; an existing order (needs a completed checkout — `[BLOCKED: needs Razorpay keys]` to create a paid one).

### Data loading
- [ ] Escrow timeline — EXPECTED: a 7-step timeline (Order placed → Payment in escrow → Seller confirmed → Shipped → In transit → Delivered → Payment released) with completed steps green, current step pulsing gold "Now", and timestamps on completed steps. Desktop horizontal, mobile vertical.
- [ ] Escrow status card — EXPECTED: "Payment held in escrow" (or "Payment released to seller" when completed) with the amount.
- [ ] Live tracking — EXPECTED: once shipped, a "Live tracking" card with stage dots (Booked → … → Delivered), AWB/Carrier/Expected when available, and an "Open tracker" link. Before shipping: "Live tracking appears once the lot is shipped."
- [ ] Amount breakdown — EXPECTED: Subtotal, Platform commission, GST, Freight (or "Free"), and Total paid.
- [ ] Seller card — EXPECTED: seller initials/name, city/state, response rate.
- [ ] Voice message thread — EXPECTED: a voice message component at the bottom.
- [ ] "Payment successful" toast — STEPS: arrive with `?paid=true`. EXPECTED: toast "Payment successful! Your order is confirmed."

### Interactions
- [ ] Download Invoice — STEPS: click "Invoice". EXPECTED: opens the invoice in a new tab; if not ready, toast "Invoice not available yet".
- [ ] Download PO — STEPS: click "Download PO". EXPECTED: opens a generated PO; toast "Purchase Order [number] ready".
- [ ] Confirm receipt — STEPS: when status is "delivered", click "Confirm receipt". EXPECTED: toast "Delivery confirmed. Payment released to seller."; timeline advances.
- [ ] Raise dispute — STEPS: when eligible (paid/confirmed/shipped/in transit/delivered), click "Raise dispute". EXPECTED: goes to `/orders/[id]/dispute`.
- [ ] Cancel — STEPS: when status is pending payment, click "Cancel" → confirm in modal. EXPECTED: toast "Order cancelled successfully."; modal has "Keep order" to back out.

### Edge cases
- [ ] Bad id — EXPECTED: "Order not found" with "My orders" link.
- [ ] Confirm/Cancel failure — EXPECTED: respective error toast ("Failed to confirm delivery…" / "Failed to cancel order…").
- [ ] Invoice/PO failure — EXPECTED: "Could not download invoice…" / "Could not generate PO…".

---

## Buyer — Raise Dispute
URL: `/orders/[id]/dispute`
Pre-condition: Logged in as buyer; order eligible for dispute.

### Data loading
- [ ] Order context card — EXPECTED: thumbnail, listing title, seller, qty, total.
- [ ] Reason chips — EXPECTED: Never delivered / Item not as described / Damaged on arrival / Wrong grade-quality / Quantity mismatch / Other.

### Interactions
- [ ] Pick a reason — STEPS: click a chip. EXPECTED: it highlights green.
- [ ] Description — STEPS: type into "Describe the issue" (max 2000 chars).
- [ ] Upload evidence — STEPS: click a "+" slot, choose up to 3 images/PDFs (≤5MB each). EXPECTED: thumbnails/preview appear; only the next slot is clickable.
- [ ] File limits — STEPS: try a 4th file / >5MB / non-image-non-pdf. EXPECTED: toasts "Maximum 3 files allowed" / "[name] exceeds 5MB limit" / "[name] is not an image or PDF".
- [ ] Remove file — STEPS: click ✕ on a file. EXPECTED: it's removed.
- [ ] Submit validation — STEPS: submit without a reason. EXPECTED: toast "Please select a reason". With <20 char description: "Please describe the issue (min 20 characters)".
- [ ] Submit dispute — STEPS: pick reason, write ≥20 chars, attach files, click "Submit dispute". EXPECTED: dispute is raised, evidence uploads, toast "Dispute raised. Escrow frozen.", redirect to `/orders/[id]`.
- [ ] Cancel — STEPS: click "Cancel". EXPECTED: returns to `/orders/[id]`.

### Edge cases
- [ ] Submit failure — EXPECTED: toast "Failed to raise dispute. Please try again."

---

## Buyer — Watchlist
URL: `/watchlist`
Pre-condition: Logged in as buyer; ideally watchlist ≥1 item (save one from a listing first).

### Data loading
- [ ] Saved lots — EXPECTED: header "N saved lot(s)"; grid of saved listing cards. A green "💰 N lot(s) dropped in price" banner appears if any prices dropped.

### Interactions
- [ ] Remove from watchlist — STEPS: click the heart/remove on a card. EXPECTED: card disappears immediately, toast "Removed from watchlist".
- [ ] "Browse more" / "Browse deals →" — STEPS: click. EXPECTED: goes to `/listings`.
- [ ] Card click — STEPS: click a saved card. EXPECTED: opens its listing detail.

### Edge cases
- [ ] Empty — EXPECTED: "No saved lots yet" with "Browse deals →".
- [ ] Load error — EXPECTED: "Failed to load watchlist." with a "Try again" button.
- [ ] Remove fails — EXPECTED: card reappears, toast "Could not remove. Please try again."

---

## Buyer — Notifications
URL: `/notifications`
Pre-condition: Logged in as buyer.

### Data loading
- [ ] List — EXPECTED: notifications with type icon, title, body, time-ago. Unread ones have a gold-tinted background + gold dot; unread sorted to top.
- [ ] Header count — EXPECTED: "N unread" when applicable.

### Interactions
- [ ] Type tabs — STEPS: click All / Orders / Payments / Disputes / System. EXPECTED: list filters.
- [ ] Click a notification — STEPS: click an unread one. EXPECTED: marked read (highlight clears); if it has a link, you're navigated there.
- [ ] Mark all read — STEPS: click header "Mark all read". EXPECTED: toast "All notifications marked as read"; all clear.
- [ ] Load more — STEPS: if more than 50, click "Load more". EXPECTED: next page appends.

### Edge cases
- [ ] Empty — EXPECTED: "No notifications yet" / "No [type] notifications".
- [ ] Mark all fails — EXPECTED: toast "Failed to mark all as read".

---

## Buyer — Referral
URL: `/referral`
Pre-condition: Logged in as buyer.

### Data loading
- [ ] Code card — EXPECTED: your referral code in big gold text, a QR code image, "Copy link" and "Share on WhatsApp" buttons.
- [ ] Stats (4) — EXPECTED: Total invites, Successful, Total earned, Pending.
- [ ] "How it works" — EXPECTED: 3 numbered steps.

### Interactions
- [ ] Copy link — STEPS: click "Copy link". EXPECTED: button shows "Copied!" with a check for ~2s; link is on your clipboard.
- [ ] Share on WhatsApp — STEPS: click. EXPECTED: opens WhatsApp share with a pre-filled message containing your referral link (new tab).

### Edge cases
- [ ] Clipboard blocked — EXPECTED: toast "Could not copy to clipboard".
- [ ] Data unavailable — EXPECTED: "Referral data unavailable" state.

---

## Buyer — Profile
URL: `/profile`
Pre-condition: Logged in as buyer.

### Data loading
- [ ] Header — EXPECTED: avatar, name, email/phone/city chips, buyer tier pill, "Total spent (₹)" and "AI credits" stats.
- [ ] Account card — EXPECTED: Email, Phone, City, State.
- [ ] Business card — EXPECTED: Business name, GSTIN, Buyer tier, with a "Contact support to update…" note.

### Interactions
- [ ] Edit profile — STEPS: click "Edit profile". EXPECTED: Name, City, State become editable (State is a dropdown).
- [ ] Save — STEPS: change name/city/state, click "Save". EXPECTED: toast "Profile updated", returns to read-only.
- [ ] Cancel — STEPS: click "Cancel". EXPECTED: edits discarded.
- [ ] Change password — STEPS: click "Change password" in Security. EXPECTED: goes to `/change-password`.

### Edge cases
- [ ] Save fails — EXPECTED: toast "Failed to update profile".
- [ ] Not logged in — EXPECTED: redirected to `/login`.

---

# PORTAL 4 — ADMIN CONSOLE
App: `https://nirmalmandi-admin.vercel.app`
Login: `admin@nirmalmandi.demo` / `Admin@2026`

## Admin — Login
URL: `/login`
Pre-condition: Logged out.

### Interactions
- [ ] Page renders — EXPECTED: dark screen, NirmalMandi logo, "Admin Console" pill, email + password form.
- [ ] Empty submit — EXPECTED: red error "Email and password required".
- [ ] Show/hide password eye works.
- [ ] Valid admin login — STEPS: enter `admin@nirmalmandi.demo` / `Admin@2026`, submit. EXPECTED: redirect to `/` (admin dashboard).
- [ ] Non-admin rejected — STEPS: enter the buyer or seller credentials. EXPECTED: error "Access denied — admin accounts only".

### Edge cases
- [ ] Wrong password — EXPECTED: error "Invalid email or password".

---

## Admin — Dashboard
URL: `/`
Pre-condition: Logged in as admin.

### Data loading
- [ ] KPI cards (6) — EXPECTED: Total GMV, Active listings, Active sellers, Active buyers, Today's commission, Open disputes — each with a % change sub-line.
- [ ] GMV chart — EXPECTED: "GMV — last 30 days" green area chart; hovering shows a tooltip with date + value. If empty, "No GMV data available".
- [ ] Alert cards (3) — EXPECTED: disputes-need-attention (red), listings-ageing (gold), KYC-pending (blue), each with a CTA.
- [ ] Recent transactions table — EXPECTED: Order / Buyer / Seller / Amount / Status / Time. If none, "No recent transactions".

### Interactions
- [ ] Refresh — STEPS: click "Refresh". EXPECTED: all four queries refetch.
- [ ] Alert CTAs — STEPS: click "View dispute queue" / "View in inventory" / "Review KYC docs". EXPECTED: navigate to `/disputes`, `/inventory`, `/kyc`.
- [ ] "View all →" on transactions — EXPECTED: goes to `/transactions`.

---

## Admin — Inventory
URL: `/inventory`
Pre-condition: Logged in as admin.

### Data loading
- [ ] Stat chips (3) — EXPECTED: Total inventory value, Ageing 30+ days, Stuck capital (display figures).
- [ ] Listings table — EXPECTED: checkbox, Listing (title), Seller, Price, Status, Views, Age (color-coded by days), Actions. Loading shows a spinner. Defaults to "Live" filter.

### Interactions
- [ ] Search — STEPS: type and press Enter. EXPECTED: table filters; page resets.
- [ ] Status tabs — STEPS: click All / Live / Paused / Sold / Expired / Flagged. EXPECTED: filters; selection cleared.
- [ ] Select rows — STEPS: tick row checkboxes / the header "select all". EXPECTED: a "N selected" bulk toolbar appears.
- [ ] Bulk Feature — STEPS: select rows, click "Feature". EXPECTED: toast "feature applied to N listings"; selection clears, table refreshes.
- [ ] Bulk Pause — STEPS: select rows, click "Pause". EXPECTED: toast "pause applied to N listings".
- [ ] Bulk Price — STEPS: select rows, click "Price". EXPECTED: a modal opens; enter a new price, "Apply" → toast "change_price applied to N listings".
- [ ] Bulk Delist — STEPS: select rows, click "Delist". EXPECTED: toast "delist applied to N listings".
- [ ] Per-row Feature — STEPS: click "Feature" on a row. EXPECTED: refreshes (or toast "Failed" on error).
- [ ] Per-row Pause/Unpause — STEPS: click. EXPECTED: toggles pause; refreshes.
- [ ] Per-row Delist — STEPS: click "Delist" → confirm "Delist this listing?". EXPECTED: refreshes.
- [ ] Pagination — STEPS: use ‹ / › with >20 rows. EXPECTED: "Page X of Y" updates.

### Edge cases
- [ ] Bulk with nothing selected — EXPECTED: toast "Select listings first".
- [ ] No results — EXPECTED: "No listings found".
- [ ] Action failure — EXPECTED: toast "Failed to [action]" / "Failed".

---

## Admin — Transactions
URL: `/transactions`
Pre-condition: Logged in as admin.

### Data loading
- [ ] Table — EXPECTED: Order / Buyer / Seller / Amount / Escrow (Holding/Released pill) / Status / Date / Actions. Loading spinner.

### Interactions
- [ ] Search — STEPS: type order/buyer/seller, press Enter. EXPECTED: table filters.
- [ ] Status filter tabs — STEPS: click All / Pending / Paid / Confirmed / Shipped / Delivered / Completed / Disputed / Cancelled. EXPECTED: table filters.
- [ ] Freeze escrow — STEPS: click "Freeze" on a row. EXPECTED: toast "Escrow frozen"; table refreshes.
- [ ] Release escrow — STEPS: click "Release". EXPECTED: toast "Escrow released".
- [ ] Export CSV button present (cosmetic).
- [ ] Pagination — STEPS: use ‹ / ›. EXPECTED: page changes.

### Edge cases
- [ ] No results — EXPECTED: "No transactions found".
- [ ] Freeze/Release failure — EXPECTED: toast "Failed to freeze escrow" / "Failed to release escrow".

---

## Admin — Disputes
URL: `/disputes`
Pre-condition: Logged in as admin; ideally ≥1 dispute (a buyer must have raised one).

### Data loading
- [ ] Header counts — EXPECTED: "N open · M under review".
- [ ] Dispute cards — EXPECTED: each card shows reason, order number, "buyer vs seller", raised date, amount, status badge, and an SLA timer ("Nh remaining" or "Overdue Nh", color-coded). The first card auto-expands.

### Interactions
- [ ] Tabs — STEPS: click Open / Under review / Resolved / Escalated. EXPECTED: list filters by status.
- [ ] Expand a card — STEPS: click a card. EXPECTED: it expands showing buyer statement, evidence links, and (if unresolved) the resolution panel.
- [ ] Choose outcome — STEPS: in an expanded unresolved dispute, click "Release to seller" or "Refund buyer". EXPECTED: the chosen side highlights green.
- [ ] Resolution note validation — STEPS: try "Resolve" with under 20 chars. EXPECTED: toast "Resolution note must be at least 20 characters" (Resolve/Escalate buttons stay disabled).
- [ ] Resolve — STEPS: write ≥20 chars, optional internal notes, click "Resolve". EXPECTED: toast "Dispute resolved"; list refreshes.
- [ ] Escalate — STEPS: write ≥20 chars, click "Escalate". EXPECTED: toast "Dispute escalated to senior review".
- [ ] Evidence links — STEPS: click "📎 filename". EXPECTED: opens the evidence file in a new tab.
- [ ] Refresh — STEPS: click "Refresh". EXPECTED: list reloads.

### Edge cases
- [ ] No disputes — EXPECTED: "No disputes for this filter." empty state.
- [ ] Resolve/escalate failure — EXPECTED: toast "Failed to resolve dispute" / "Failed to escalate dispute".

---

## Admin — Users
URL: `/users`
Pre-condition: Logged in as admin.

### Data loading
- [ ] Header count — EXPECTED: "N users".
- [ ] Table — EXPECTED: Name (avatar+name), Phone, Role pill, Status badge, Joined date, Actions.

### Interactions
- [ ] Tabs — STEPS: click All users / Buyers / Sellers. EXPECTED: table filters by role.
- [ ] Search — STEPS: type a name/phone, press Enter. EXPECTED: filters.
- [ ] Suspend — STEPS: click "Suspend" on an active user → a browser prompt asks for a reason → enter a reason. EXPECTED: toast "[name] suspended"; table refreshes. (Cancelling the prompt aborts.)
- [ ] Activate — STEPS: click "Activate" on a suspended user. EXPECTED: toast "[name] activated".
- [ ] Pagination — STEPS: use ‹ / ›. EXPECTED: "Page X of Y" updates.

### Edge cases
- [ ] No users — EXPECTED: "No users found".
- [ ] Suspend/Activate failure — EXPECTED: toast "Failed to suspend user" / "Failed to activate user".

---

## Admin — KYC
URL: `/kyc`
Pre-condition: Logged in as admin; ideally ≥1 KYC submission.

### Data loading
- [ ] KPI cards (4) — EXPECTED: Total, Pending, Verified today, Rejected today (from `/admin/kyc/stats`).
- [ ] Pending count — EXPECTED: the "Pending" KPI reflects the number awaiting review.
- [ ] Submissions table — EXPECTED: Seller (avatar+name+business), Phone, Documents link, Submitted date, Status badge, Action buttons.

### Interactions
- [ ] Tabs — STEPS: click All / Pending / Verified / Rejected. EXPECTED: table filters.
- [ ] Open review panel — STEPS: click a seller / "GSTIN + PAN" / "Approve" / "Reject". EXPECTED: a right-side review drawer slides in with seller details and document list.
- [ ] Preview a document — STEPS: in the drawer click "Preview". EXPECTED: a modal shows the image inline, or a PDF in an iframe, with "Open" (new tab).
- [ ] Approve · Basic — STEPS: click "Approve · Basic". EXPECTED: toast "KYC approved (basic)"; drawer closes; lists refresh.
- [ ] Approve · Verified — STEPS: click "Approve · Verified". EXPECTED: toast "KYC approved (verified)".
- [ ] Reject — STEPS: click "Reject", enter a rejection reason, "Confirm rejection". EXPECTED: toast "KYC rejected". Empty reason → toast "Please provide a rejection reason".
- [ ] Request docs — STEPS: click "Request docs", enter a message, "Send request". EXPECTED: toast "Additional docs requested". Empty message → toast "Please enter a message".
- [ ] Refresh — STEPS: click "Refresh". EXPECTED: list reloads.
- [ ] Pagination — STEPS: with >20, use Previous/Next. EXPECTED: page changes.

### Edge cases
- [ ] No submissions — EXPECTED: "No KYC submissions found".
- [ ] Action failure — EXPECTED: toast "Action failed — please try again".

---

## Admin — Categories
URL: `/categories`
Pre-condition: Logged in as admin.

### Data loading
- [ ] Table — EXPECTED: Category (initial+name), Slug, Commission %, GST %, Listings count, Status toggle, Edit action.

### Interactions
- [ ] Add category — STEPS: click "Add category", enter name (slug auto-fills), commission %, GST %, click "Create". EXPECTED: toast "Category created"; modal closes; new row appears.
- [ ] Edit category — STEPS: click "Edit" on a row, change values, click "Update". EXPECTED: toast "Category updated".
- [ ] Toggle active — STEPS: flip a category's status toggle. EXPECTED: toast "Status updated"; toggle state changes.
- [ ] Create disabled — EXPECTED: "Create" is disabled until a Name is entered.
- [ ] Cancel/✕ — STEPS: close the modal. EXPECTED: no change.

### Edge cases
- [ ] Create/Update/Toggle failure — EXPECTED: toast "Failed to create category" / "Failed to update category" / "Failed to toggle status".

---

## Admin — Analytics
URL: `/analytics`
Pre-condition: Logged in as admin.

### Data loading
- [ ] KPI cards (8) — EXPECTED: Total GMV, Commission earned, Active listings, Active sellers, Active buyers, Open disputes, Ageing listings, KYC pending.
- [ ] GMV history chart — EXPECTED: area chart for the selected window; empty → "No GMV data available".
- [ ] Inventory ageing heatmap — EXPECTED: sectors × age buckets (0–30d / 31–60d / 61–90d+) shaded by stuck-capital value, with a legend.
- [ ] Demand vs supply — EXPECTED: per-sector bars for Demand (views) vs Supply (listings).
- [ ] Seller scorecard — EXPECTED: top-20 sellers with Tier, GMV, Orders, Score, Dispute%, Fill%.
- [ ] BI engine panels — EXPECTED: Engine 5 Buyer behavior funnel, Engine 7 CVR by sector, Engine 8 Geographic demand, Engine 6 Seller acquisition targeting, and a Board report panel.
- [ ] Summary stats — EXPECTED: when GMV data exists, Total GMV / Daily average / Peak day cards.

### Interactions
- [ ] GMV window tabs — STEPS: click 7d / 14d / 30d / 60d / 90d. EXPECTED: GMV chart + summary recompute.
- [ ] Export (GMV CSV) — STEPS: click "Export" (header). EXPECTED: a `gmv-[N]d.csv` downloads; toast "GMV exported". With no data → toast "No data to export".
- [ ] Buyer behavior days — STEPS: change the 7/14/30 days select. EXPECTED: funnel refreshes.
- [ ] Generate board report — STEPS: click "Generate report". EXPECTED: spinner, then a PDF opens in a new tab and toast "Board report generated for [period]"; it appears under "Previous reports".

### Edge cases
- [ ] Empty data — EXPECTED: each panel shows its own "No data" placeholder; page doesn't crash.
- [ ] Board report failure — EXPECTED: toast "Failed to generate board report".

---

## Admin — Payouts
URL: `/payouts`
Pre-condition: Logged in as admin.

### Data loading
- [ ] KPI cards (3) — EXPECTED: Pending payouts, Processed today, On hold.
- [ ] Table — EXPECTED: checkbox, Seller, Amount, Account (masked ••last4), Status badge, Date, Action. Defaults to "Pending" tab.

### Interactions
- [ ] Tabs — STEPS: click All / Pending / Scheduled / On hold / Processed. EXPECTED: table filters; selection clears.
- [ ] Select rows — STEPS: tick checkboxes / select-all. EXPECTED: a "Process all ready (N)" button appears in the header.
- [ ] Bulk approve — STEPS: select rows, click "Process all ready". EXPECTED: toast "N payouts approved"; selection clears; refreshes.
- [ ] Per-row Process — STEPS: click "Process" on a pending/scheduled row. EXPECTED: toast "Payout processed"; refreshes. (Held rows show an "On hold" pill instead.)
- [ ] Export button present (cosmetic).
- [ ] Pagination — STEPS: use ‹ / ›. EXPECTED: page changes.

### Edge cases
- [ ] No payouts — EXPECTED: "No payouts found".
- [ ] Process/bulk failure — EXPECTED: toast "Failed to process" / "Bulk approve failed".

---

## Admin — Audit Log
URL: `/audit`
Pre-condition: Logged in as admin. (Perform a few admin actions first to populate entries.)

### Data loading
- [ ] Log list — EXPECTED: rows with an entity-type tile, "[Admin] · [action]", "entity · ID … · IP", and a timestamp. Each admin action you took earlier should appear.

### Interactions
- [ ] Search — STEPS: type an action/admin name, press Enter. EXPECTED: filters.
- [ ] Entity type filter — STEPS: choose Listing/User/Order/Dispute/Category/Payout from the dropdown. EXPECTED: filters by type.
- [ ] Date range — STEPS: set "from" and "to" dates. EXPECTED: filters by date.
- [ ] Clear filters — STEPS: click "Clear filters" (appears when any filter is set). EXPECTED: all filters reset.
- [ ] Export CSV — STEPS: click "Export CSV". EXPECTED: an `audit-[date].csv` downloads; toast "CSV exported".
- [ ] Pagination — STEPS: use ‹ / › with >50 entries. EXPECTED: page changes.

### Edge cases
- [ ] No entries — EXPECTED: "No audit entries found".
- [ ] Export failure — EXPECTED: toast "Export failed".

---

## Admin — Settings
URL: `/settings`
Pre-condition: Logged in as admin.

### Data loading
- [ ] Sections render — EXPECTED: Fees & Rates, Escrow & Dispute, Listing Configuration, Registrations & Features, KPI Alert Thresholds, Maintenance — each a card with rows of inputs/toggles populated from saved settings.

### Interactions
- [ ] Edit a number field — STEPS: change e.g. "Default Commission Rate (%)". EXPECTED: an "⚠ You have unsaved changes" banner appears; a "Reset" button shows.
- [ ] Toggle a feature — STEPS: flip e.g. "Enable Flash Sales" / "Maintenance Mode". EXPECTED: dirty state set.
- [ ] Save changes — STEPS: click "Save changes". EXPECTED: spinner, toast "Settings saved"; dirty banner clears.
- [ ] Reset — STEPS: change something then click "Reset". EXPECTED: values revert to last-saved; dirty banner clears.

### Edge cases
- [ ] Save failure — EXPECTED: toast "Failed to save settings".

---

## Admin — Notifications
URL: `/notifications`
Pre-condition: Logged in as admin.

### Data loading
- [ ] Logs list — EXPECTED: notification log entries with type-colored icon, title, body, channel pill, user name/phone, and a timestamp.
- [ ] Header count — EXPECTED: "N notifications" when present.

### Interactions
- [ ] Open broadcast form — STEPS: click "Broadcast". EXPECTED: a "Send Broadcast" panel opens with Title, Message (with N/500 counter), Channel (Push/WhatsApp/SMS/All), and Target (All users/Buyers/Sellers).
- [ ] Broadcast validation — EXPECTED: "Send broadcast" is disabled until Title and Message are filled.
- [ ] Send broadcast — STEPS: fill title + message, pick channel/target, click "Send broadcast". EXPECTED: a "Broadcast queued!" confirmation showing how many notifications were queued. `[BLOCKED: needs Resend/domain]` for any email/SMS/WhatsApp actually being delivered. Click "Done" to close.
- [ ] Broadcast failure — EXPECTED: toast "Broadcast failed".
- [ ] Channel filter tabs — STEPS: click All / WhatsApp / Push / SMS. EXPECTED: logs filter by channel.
- [ ] Search — STEPS: type a user/message, press Enter. EXPECTED: logs filter.
- [ ] Pagination — STEPS: use ‹ / › with >30 logs. EXPECTED: page changes.

### Edge cases
- [ ] No logs — EXPECTED: "No notifications found".

---

# CROSS-CUTTING / END-TO-END FLOWS (dependency chains)

These confirm features that depend on each other. Run them in order.

- [ ] **Listing lifecycle** — STEPS: log in as seller → create a listing (New Listing) → it appears in My Listings and on the public `/listings` and home Featured grid → open its detail page. EXPECTED: the same listing is visible across all surfaces.
- [ ] **Watchlist needs a listing** — STEPS: as buyer, open a listing detail → save to watchlist → check `/watchlist`. EXPECTED: the saved listing appears; removing it there removes it.
- [ ] **Order needs a listing + checkout** — STEPS: as buyer, Buy now on a live listing → fill checkout → reach Razorpay popup. `[BLOCKED: needs Razorpay keys]` — completing payment creates the order that then appears in Buyer Orders, Seller Orders, Admin Transactions.
- [ ] **Mark shipped needs a paid order** — STEPS: (after a paid order exists) as seller, Orders → Mark shipped → enter tracking. EXPECTED: buyer's Order Detail shows Live tracking and the timeline advances to Shipped.
- [ ] **Confirm delivery releases escrow** — STEPS: when an order reaches "delivered", buyer clicks "Confirm receipt". EXPECTED: escrow released → appears as Released in seller Payouts/escrow summary and admin Transactions.
- [ ] **Dispute freezes escrow** — STEPS: buyer raises a dispute on an eligible order → it appears in Admin → Disputes queue with an SLA timer → admin resolves (release to seller / refund buyer). EXPECTED: dispute status updates on both sides.
- [ ] **KYC approval changes seller tier** — STEPS: seller submits docs (via Profile) → admin KYC approves as Verified → seller's KYC page/profile shows "KYC verified" and Verified tier.
- [ ] **Category commission affects payouts** — STEPS: admin sets a category's commission % → a new sale in that category should compute commission accordingly in seller Payouts.
- [ ] **Admin actions appear in Audit Log** — STEPS: perform several admin actions (suspend a user, feature a listing, resolve a dispute) → open Audit Log. EXPECTED: each action is logged with admin name, entity, and timestamp.
- [ ] **Password reset email** — `[BLOCKED: needs Resend/domain]` Forgot Password shows success but no email is delivered until the sender/domain is configured.
- [ ] **Broadcast delivery** — `[BLOCKED: needs Resend/domain]` Admin broadcast queues notifications; actual WhatsApp/SMS/email delivery requires configured providers.

---

## Quick smoke test (5 minutes)
- [ ] Home loads with deals.
- [ ] `/listings` loads, search + a filter work.
- [ ] Open a listing detail; lot calculator recomputes.
- [ ] Seller login → dashboard KPIs load.
- [ ] Create a listing → it shows in My Listings.
- [ ] Buyer login → dashboard loads; open a listing; save to watchlist; check `/watchlist`.
- [ ] Admin login → dashboard KPIs + GMV chart load.
- [ ] Admin Inventory: select a row and Feature it.
- [ ] Admin Settings: toggle something, Save, confirm "Settings saved".
