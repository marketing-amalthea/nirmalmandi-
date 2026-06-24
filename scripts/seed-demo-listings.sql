-- ============================================================
-- NirmalMandi — 5 Demo Listings for seller@nirmalmandi.demo
-- Run this in the Neon SQL console
-- ============================================================

-- Step 1: Ensure sectors exist (safe upsert)
INSERT INTO sectors (id, name, slug, commission_rate, gst_rate, admin_approved, status, created_at, updated_at)
VALUES
  ('b5cb8935-cf1c-43af-a7d8-1791ee4ec117', 'Automobiles',          'automobiles',  0.030, 0.28, true, 'active', NOW(), NOW()),
  ('7ef70f23-4078-4e0d-af96-dc0989e2ae9c', 'Clothing & Textiles',  'clothing',     0.040, 0.12, true, 'active', NOW(), NOW()),
  ('59c9c157-52fb-45cf-afe1-5f8ab48dd76e', 'FMCG & Food',          'fmcg',         0.030, 0.05, true, 'active', NOW(), NOW()),
  ('075530ac-8ccb-4042-abf7-03d044ee6d7a', 'Furniture',            'furniture',    0.040, 0.18, true, 'active', NOW(), NOW()),
  ('083edb57-efa5-4ad9-859c-d7f7866b543b', 'Industrial Machinery', 'machinery',    0.025, 0.18, true, 'active', NOW(), NOW()),
  ('142da4ad-f331-45da-9525-5d9d83867319', 'Pharma & Healthcare',  'pharma',       0.030, 0.12, true, 'active', NOW(), NOW()),
  ('7633c8a6-6d81-4592-824a-a2241f7f5b11', 'Software & Licenses',  'software',     0.050, 0.18, true, 'active', NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Electronics',          'electronics',  0.040, 0.18, true, 'active', NOW(), NOW()),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Construction',         'construction', 0.030, 0.18, true, 'active', NOW(), NOW()),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Agriculture',          'agriculture',  0.025, 0.05, true, 'active', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active';

-- Step 2: Insert 5 rich demo listings
DO $$
DECLARE
  v_seller_id UUID;
BEGIN
  -- Get the demo seller's profile id
  SELECT sp.id INTO v_seller_id
  FROM seller_profiles sp
  JOIN users u ON u.id = sp.user_id
  WHERE u.email = 'seller@nirmalmandi.demo'
  LIMIT 1;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Demo seller not found. Make sure seller@nirmalmandi.demo is registered first.';
  END IF;

  -- ── Listing 1: Clothing ────────────────────────────────────
  INSERT INTO listings (
    id, seller_id, sector_id, title, description, dead_stock_type,
    condition_grade, lot_type, total_quantity, available_quantity, moq,
    unit, price_type, asking_price, floor_price, mrp,
    sector_specific_fields, images,
    state, city, urgency_days, urgency_score,
    is_featured, status, views_count, inquiries_count, watchlist_count,
    created_at, updated_at
  ) VALUES (
    uuid_generate_v4(), v_seller_id, '7ef70f23-4078-4e0d-af96-dc0989e2ae9c',
    '1,200 pcs Premium Cotton Kurta Set — Winter 2024 Overstock, Sizes XS–5XL',
    E'Liquidating 1,200 units of unsold winter inventory from a premium B2B clothing brand.\n\n'
    '**Product Details**\n'
    '• Brand: NirmalWear (in-house label)\n'
    '• Fabric: 100% premium combed cotton, 180 GSM\n'
    '• Sizes: XS (80 pcs), S (200 pcs), M (320 pcs), L (320 pcs), XL (200 pcs), XXL (80 pcs)\n'
    '• Colours: Indigo Blue (400 pcs), Mustard Yellow (400 pcs), Rust Orange (400 pcs)\n'
    '• Stitching: Double-needle hem, reinforced collar\n\n'
    '**Reason for Sale**\n'
    'These were produced for the Diwali–Makar Sankranti season order that was cancelled by our retail chain buyer. All units are brand new with original tags, packed in individual polybags.\n\n'
    '**Condition**\n'
    '• Grade A — Mint condition, zero defects\n'
    '• No fading, no pilling, no stitching issues\n'
    '• Original manufacturer packaging intact\n\n'
    '**Commercial Terms**\n'
    '• GST Invoice provided (12% GST applicable)\n'
    '• MOQ: 100 pieces\n'
    '• Bulk discount available above 500 pcs — contact for negotiated rate\n'
    '• Export quality — suitable for B2B retail, gifting, or export\n\n'
    '**Logistics**\n'
    '• Ready to dispatch from Kanpur warehouse within 2 business days\n'
    '• Platform logistics (Delhivery) available or buyer can arrange own transport\n'
    '• Packed in master cartons of 50 pcs each (24 cartons total)',
    'seasonal', 'A', 'partial', 1200, 1200, 100,
    'pieces', 'best_offer', 185, 140, 650,
    '{"reason_for_sale": "Winter season order cancellation", "condition_notes": "All units brand new with original tags", "storage": "Climate-controlled warehouse", "export_quality": true, "colours": ["Indigo Blue", "Mustard Yellow", "Rust Orange"], "sizes": "XS to XXL"}',
    ARRAY[
      'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=800',
      'https://images.unsplash.com/photo-1594938298603-c8148c4b4357?w=800',
      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800'
    ],
    'Uttar Pradesh', 'Kanpur', 21, 7,
    true, 'live', 847, 34, 18,
    NOW() - INTERVAL '5 days', NOW()
  );

  -- ── Listing 2: FMCG ───────────────────────────────────────
  INSERT INTO listings (
    id, seller_id, sector_id, title, description, dead_stock_type,
    condition_grade, lot_type, total_quantity, available_quantity, moq,
    unit, price_type, asking_price, floor_price, mrp,
    sector_specific_fields, images,
    state, city, urgency_days, urgency_score,
    is_featured, status, views_count, inquiries_count, watchlist_count,
    created_at, updated_at
  ) VALUES (
    uuid_generate_v4(), v_seller_id, '59c9c157-52fb-45cf-afe1-5f8ab48dd76e',
    '8,000 Units Colgate MaxFresh 200ml — Outer Carton Damaged, Tubes Intact & Sealed',
    E'Bulk lot of 8,000 units of Colgate MaxFresh 200ml toothpaste available for immediate liquidation.\n\n'
    '**Product Details**\n'
    '• Brand: Colgate (Genuine product, FSSAI certified)\n'
    '• SKU: Colgate MaxFresh Blue 200ml + pump\n'
    '• Manufacture date: Jan 2024\n'
    '• Expiry date: Jan 2026 (18+ months remaining)\n\n'
    '**Damage Assessment**\n'
    '• Outer master cartons: 40% have water damage / dents from transit\n'
    '• Inner tubes: 100% INTACT — sealed, no leakage, no contamination\n'
    '• Pump mechanism: Fully functional\n'
    '• This is purely cosmetic outer packaging damage — the product is 100% consumable\n\n'
    '**Why It''s Being Sold**\n'
    'A warehouse fire sprinkler incident damaged the outer cartons during storage. The actual product passed quality inspection with zero defects. Cannot be sold through retail channels due to packaging standards — perfect for institutional buyers, bulk gifting, or repackaging businesses.\n\n'
    '**Commercial Terms**\n'
    '• Price: ₹42/unit (MRP ₹140 — 70% below retail)\n'
    '• GST Invoice (5% GST) provided\n'
    '• MOQ: 500 units\n'
    '• Can sell in lots of 500, 1000, 2000, or full 8000\n\n'
    '**Compliance**\n'
    '• FSSAI license: 10014022000003\n'
    '• Original manufacturer invoice available on request\n'
    '• Suitable for hotels, corporates, NGOs, FMCG distributors',
    'damaged_packaging', 'B', 'partial', 8000, 8000, 500,
    'pieces', 'fixed', 42, 35, 140,
    '{"brand": "Colgate", "sku": "MaxFresh 200ml Blue", "expiry_date": "2026-01-31", "manufacture_date": "2024-01-15", "fssai_license": "10014022000003", "damage_type": "Outer carton only", "inner_product_condition": "100% intact", "shelf_life_remaining_months": 18}',
    ARRAY[
      'https://images.unsplash.com/photo-1619451683867-ae0e2e6e8434?w=800',
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800'
    ],
    'Gujarat', 'Surat', 14, 9,
    true, 'live', 1243, 67, 29,
    NOW() - INTERVAL '3 days', NOW()
  );

  -- ── Listing 3: Industrial Machinery ───────────────────────
  INSERT INTO listings (
    id, seller_id, sector_id, title, description, dead_stock_type,
    condition_grade, lot_type, total_quantity, available_quantity, moq,
    unit, price_type, asking_price, floor_price, mrp,
    sector_specific_fields, images,
    state, city, urgency_days, urgency_score,
    is_featured, status, views_count, inquiries_count, watchlist_count,
    created_at, updated_at
  ) VALUES (
    uuid_generate_v4(), v_seller_id, '083edb57-efa5-4ad9-859c-d7f7866b543b',
    '12 Units Elgi EG-11 Air Compressor 11kW 50Hz — Factory Surplus After Plant Upgrade',
    E'Liquidating 12 units of Elgi EG-11 screw air compressors from our Hyderabad manufacturing plant following a capacity upgrade to larger 37kW units.\n\n'
    '**Equipment Specifications**\n'
    '• Make: Elgi Equipment Ltd (India''s leading compressor brand)\n'
    '• Model: EG-11 Plus Rotary Screw Air Compressor\n'
    '• Power: 11kW / 15HP\n'
    '• Frequency: 50Hz\n'
    '• Capacity: 43 CFM @ 7.5 bar\n'
    '• Tank: 270-litre vertical receiver\n'
    '• Voltage: 415V, 3-phase\n'
    '• Dimensions: 1750mm x 640mm x 1250mm\n'
    '• Weight: 310 kg each\n\n'
    '**Condition**\n'
    '• Grade A — All 12 units in excellent working condition\n'
    '• Average usage: 1,800–2,200 hours (low hours for this machine type)\n'
    '• Last serviced: October 2024 (Elgi authorized service center)\n'
    '• No leaks, no oil contamination, all gauges calibrated\n'
    '• Belts and filters replaced during last service\n'
    '• Full service history available\n\n'
    '**Reason for Disposal**\n'
    'Plant expansion to 37kW compressors for higher capacity production lines. These 11kW units are surplus — all in excellent working order.\n\n'
    '**What''s Included**\n'
    '• Compressor unit\n'
    '• Air receiver tank (270L)\n'
    '• Control panel\n'
    '• Original Elgi manual and service records\n'
    '• 3-month operational warranty from our side\n\n'
    '**Commercial Terms**\n'
    '• Price: ₹1,85,000/unit (New MRP ₹3,80,000 — 51% saving)\n'
    '• Can sell individually or in lot of 3, 6, or all 12\n'
    '• GST Invoice (28% GST) with HSN code\n'
    '• Buyer to arrange transport from Hyderabad\n'
    '• Demo run can be arranged at site before purchase',
    'excess', 'A', 'partial', 12, 12, 1,
    'pieces', 'best_offer', 185000, 160000, 380000,
    '{"brand": "Elgi", "model": "EG-11 Plus", "power_kw": 11, "cfm": 43, "bar": 7.5, "tank_litre": 270, "voltage": "415V 3-phase", "avg_hours_used": 2000, "last_serviced": "2024-10-15", "warranty_months": 3, "hsn_code": "84141090"}',
    ARRAY[
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800',
      'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=800'
    ],
    'Telangana', 'Hyderabad', 45, 5,
    false, 'live', 312, 18, 9,
    NOW() - INTERVAL '12 days', NOW()
  );

  -- ── Listing 4: Furniture ──────────────────────────────────
  INSERT INTO listings (
    id, seller_id, sector_id, title, description, dead_stock_type,
    condition_grade, lot_type, total_quantity, available_quantity, moq,
    unit, price_type, asking_price, floor_price, mrp,
    sector_specific_fields, images,
    state, city, urgency_days, urgency_score,
    is_featured, status, views_count, inquiries_count, watchlist_count,
    created_at, updated_at
  ) VALUES (
    uuid_generate_v4(), v_seller_id, '075530ac-8ccb-4042-abf7-03d044ee6d7a',
    '60-Seat Cafeteria Furniture Set (Tables + Chairs) — IT Company Closure, Brand New',
    E'Complete 60-seat cafeteria furniture set from a newly constructed IT campus in Pune that never went operational. The entire fit-out is brand new — never used commercially.\n\n'
    '**What''s Included (Complete Set)**\n'
    '• 15 units: 4-seater dining tables (laminate top, powder-coated mild steel frame)\n'
    '• 60 units: Stackable cafeteria chairs (polypropylene shell, tubular steel legs)\n'
    '• 2 units: 6-foot serving counter with under-counter storage\n'
    '• 1 unit: Display rack / menu board stand\n\n'
    '**Specifications — Dining Tables**\n'
    '• Size: 1200mm x 750mm x 760mm (H)\n'
    '• Top: 18mm BWR-grade laminate (Sunmica), anti-scratch\n'
    '• Frame: 1.5" square MS pipe, epoxy powder-coated (grey)\n'
    '• Load capacity: 80kg\n\n'
    '**Specifications — Chairs**\n'
    '• Model: Durian CafeStack Pro\n'
    '• Shell: UV-stabilized polypropylene (charcoal grey)\n'
    '• Frame: 18mm tubular chrome steel\n'
    '• Stackable up to 6 high\n'
    '• Weight: 4.2kg each\n\n'
    '**Condition**\n'
    '• Grade A — Brand new, never used\n'
    '• Still in original protective wrap / packaging for 40 of the 60 chairs\n'
    '• Minor showroom scuffs on 5 tables (from installation only)\n\n'
    '**Why Selling**\n'
    'The IT company that commissioned this fit-out went into liquidation before the building opened. Purchased by us at auction — liquidating to recover capital.\n\n'
    '**Commercial Terms**\n'
    '• Complete set only: ₹3,20,000 (MRP ₹7,50,000)\n'
    '• Individual table ₹8,000 | Individual chair ₹1,800 (min 10 chairs)\n'
    '• GST Invoice (18% GST)\n'
    '• Buyer arranges pickup from Pune warehouse\n'
    '• Disassembly and loading assistance available',
    'excess', 'A', 'full', 1, 1, 1,
    'sets', 'fixed', 320000, 280000, 750000,
    '{"set_includes": "15 tables + 60 chairs + 2 serving counters", "table_size_mm": "1200x750x760", "chair_model": "Durian CafeStack Pro", "seating_capacity": 60, "condition_notes": "Brand new, 40 chairs still in original wrap", "reason": "IT company liquidation before opening", "individual_sale_available": true}',
    ARRAY[
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
      'https://images.unsplash.com/photo-1581539250439-c96689b516dd?w=800',
      'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800'
    ],
    'Maharashtra', 'Pune', 30, 6,
    true, 'live', 589, 22, 15,
    NOW() - INTERVAL '8 days', NOW()
  );

  -- ── Listing 5: Automobiles ────────────────────────────────
  INSERT INTO listings (
    id, seller_id, sector_id, title, description, dead_stock_type,
    condition_grade, lot_type, total_quantity, available_quantity, moq,
    unit, price_type, asking_price, floor_price, mrp,
    sector_specific_fields, images,
    state, city, urgency_days, urgency_score,
    is_featured, status, views_count, inquiries_count, watchlist_count,
    created_at, updated_at
  ) VALUES (
    uuid_generate_v4(), v_seller_id, 'b5cb8935-cf1c-43af-a7d8-1791ee4ec117',
    '3,500 pcs Bosch Genuine Fuel Injectors (Multi-Model) — Discontinued SKUs Clearance',
    E'Bulk clearance of 3,500 units of Bosch genuine fuel injectors across 8 discontinued SKUs. These were ordered for a fleet maintenance contract that was cancelled post-COVID.\n\n'
    '**SKU Breakdown**\n'
    '• 0280150714 — Maruti Suzuki Alto K10 (450 pcs)\n'
    '• 0280150997 — Honda City Gen 3 (380 pcs)\n'
    '• 0280155865 — Hyundai i20 Kappa 1.2 (520 pcs)\n'
    '• 0261500109 — Tata Nexon 1.2 Revotron (480 pcs)\n'
    '• 0280155819 — Mahindra Bolero 2.5 Di (320 pcs)\n'
    '• 0280158821 — Ford EcoSport 1.0L (290 pcs)\n'
    '• 0280158557 — Renault Kwid 1.0 SCe (380 pcs)\n'
    '• 0280158040 — Nissan Micra 1.2L (680 pcs)\n\n'
    '**Product Details**\n'
    '• Brand: BOSCH (Germany — 100% genuine, not aftermarket)\n'
    '• Type: Multi-point fuel injection (MPFI)\n'
    '• Resistance: 12–16 Ohm\n'
    '• Operating pressure: 3.0 bar\n'
    '• Connector: EV1 (Bosch standard)\n'
    '• Manufacture date: 2021–2022 (within 5-year shelf life)\n\n'
    '**Condition**\n'
    '• Grade A — Brand new, never fitted, never tested\n'
    '• All units in original Bosch retail boxes with part numbers\n'
    '• Stored in temperature-controlled dry environment since purchase\n'
    '• Zero corrosion, O-rings and seals intact\n\n'
    '**Certificates & Compliance**\n'
    '• Original Bosch purchase invoices available\n'
    '• AIS-137 compliant (OBD-II ready)\n'
    '• GST Invoice (28% GST) with HSN 8481\n\n'
    '**Commercial Terms**\n'
    '• Blended rate: ₹2,800/unit (Bosch dealer MRP ₹6,500–8,200 depending on SKU)\n'
    '• MOQ: 50 units (mixed SKUs acceptable)\n'
    '• Bulk pricing: 500+ units @ ₹2,400/unit | 1000+ units @ ₹2,100/unit\n'
    '• Ideal buyers: Fleet operators, auto parts distributors, OEM Tier-2 suppliers, export buyers',
    'obsolete', 'A', 'partial', 3500, 3500, 50,
    'pieces', 'best_offer', 2800, 2100, 7200,
    '{"brand": "Bosch", "part_type": "MPFI Fuel Injector", "sku_count": 8, "compatible_vehicles": ["Maruti Alto K10", "Honda City", "Hyundai i20", "Tata Nexon", "Mahindra Bolero", "Ford EcoSport", "Renault Kwid", "Nissan Micra"], "manufacture_year": "2021-2022", "shelf_life_years": 5, "hsn_code": "8481", "gst_rate": 28, "ais_compliant": true, "bulk_pricing": {"500_plus": 2400, "1000_plus": 2100}}',
    ARRAY[
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800',
      'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800'
    ],
    'Maharashtra', 'Mumbai', 60, 4,
    false, 'live', 1087, 45, 31,
    NOW() - INTERVAL '2 days', NOW()
  );

  RAISE NOTICE 'SUCCESS: 5 demo listings created for seller profile %', v_seller_id;
END $$;

-- Verify
SELECT title, dead_stock_type, condition_grade, asking_price, total_quantity, state, city, is_featured
FROM listings
WHERE seller_id = (
  SELECT sp.id FROM seller_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.email = 'seller@nirmalmandi.demo'
)
ORDER BY created_at DESC;
