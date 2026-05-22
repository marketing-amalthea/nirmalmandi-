-- ============================================================
-- NirmalMandi — Full Database Schema v1.0
-- PostgreSQL 16 — Run via: psql $DATABASE_URL -f 001_initial_schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone               VARCHAR(15) UNIQUE NOT NULL,
  email               VARCHAR(255) UNIQUE,
  name                VARCHAR(255) NOT NULL,
  role                VARCHAR(20) NOT NULL CHECK (role IN ('buyer','seller','admin','super_admin')),
  language_preference VARCHAR(5) DEFAULT 'hi' CHECK (language_preference IN ('en','hi')),
  referral_code       VARCHAR(20) UNIQUE,
  referred_by         UUID REFERENCES users(id),
  status              VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_referral_code ON users(referral_code);

-- ============================================================
-- SELLER PROFILES
-- ============================================================
CREATE TABLE seller_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES users(id),
  business_name       VARCHAR(255) NOT NULL,
  business_type       VARCHAR(30) CHECK (business_type IN ('manufacturer','distributor','retailer','wholesaler')),
  gst_number          VARCHAR(20) UNIQUE,
  pan_number_enc      BYTEA, -- pgcrypto encrypted
  msme_number         VARCHAR(50),
  verification_tier   VARCHAR(20) DEFAULT 'unverified' CHECK (verification_tier IN ('unverified','basic','verified','premium')),
  performance_score   DECIMAL(5,2) DEFAULT 100.00,
  dispute_rate        DECIMAL(6,5) DEFAULT 0,
  fulfillment_rate    DECIMAL(6,5) DEFAULT 1,
  response_rate       DECIMAL(6,5) DEFAULT 1,
  total_gmv           DECIMAL(14,2) DEFAULT 0,
  bank_account_id     UUID,
  kyc_status          VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending','in_review','approved','rejected')),
  kyc_rejection_reason TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE TRIGGER seller_profiles_updated_at BEFORE UPDATE ON seller_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_seller_profiles_user_id ON seller_profiles(user_id);
CREATE INDEX idx_seller_profiles_gst ON seller_profiles(gst_number);
CREATE INDEX idx_seller_profiles_tier ON seller_profiles(verification_tier);

-- ============================================================
-- BANK ACCOUNTS
-- ============================================================
CREATE TABLE bank_accounts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id           UUID NOT NULL REFERENCES seller_profiles(id),
  account_number_enc  BYTEA NOT NULL, -- encrypted
  ifsc                VARCHAR(12) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  bank_name           VARCHAR(255),
  is_verified         BOOLEAN DEFAULT FALSE,
  penny_drop_status   VARCHAR(20) DEFAULT 'pending',
  razorpay_account_id VARCHAR(100),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER bank_accounts_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE seller_profiles ADD CONSTRAINT fk_bank_account FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);

-- ============================================================
-- BUYER PROFILES
-- ============================================================
CREATE TABLE buyer_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id),
  business_name         VARCHAR(255),
  gst_number            VARCHAR(20),
  verification_tier     VARCHAR(10) DEFAULT 'tier1' CHECK (verification_tier IN ('tier1','tier2','tier3')),
  sector_interests      TEXT[] DEFAULT '{}',
  total_purchases       DECIMAL(14,2) DEFAULT 0,
  referral_earnings     DECIMAL(12,2) DEFAULT 0,
  ai_credits_balance    INTEGER DEFAULT 50,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);
CREATE TRIGGER buyer_profiles_updated_at BEFORE UPDATE ON buyer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_buyer_profiles_user_id ON buyer_profiles(user_id);

-- ============================================================
-- SECTORS
-- ============================================================
CREATE TABLE sectors (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                          VARCHAR(100) NOT NULL,
  slug                          VARCHAR(100) UNIQUE NOT NULL,
  parent_id                     UUID REFERENCES sectors(id),
  schema_definition             JSONB DEFAULT '{}',
  is_ai_generated               BOOLEAN DEFAULT FALSE,
  admin_approved                BOOLEAN DEFAULT TRUE,
  compliance_rules              JSONB DEFAULT '{}',
  logistics_config              JSONB DEFAULT '{}',
  pricing_mode_default          VARCHAR(20) DEFAULT 'fixed',
  buyer_verification_requirements JSONB DEFAULT '{}',
  commission_rate               DECIMAL(5,4) DEFAULT 0.03,
  gst_rate                      DECIMAL(5,4) DEFAULT 0.18,
  status                        VARCHAR(20) DEFAULT 'active',
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER sectors_updated_at BEFORE UPDATE ON sectors FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed launch sectors
INSERT INTO sectors (name, slug, commission_rate, gst_rate, pricing_mode_default) VALUES
  ('Automobiles', 'automobiles', 0.015, 0.28, 'offer'),
  ('Clothing & Textiles', 'clothing', 0.03, 0.05, 'fixed'),
  ('Furniture', 'furniture', 0.03, 0.18, 'fixed'),
  ('FMCG & Food', 'fmcg', 0.025, 0.12, 'fixed'),
  ('Pharma & Healthcare', 'pharma', 0.02, 0.12, 'fixed'),
  ('Software & Licenses', 'software', 0.05, 0.18, 'fixed'),
  ('Industrial Machinery', 'machinery', 0.02, 0.18, 'offer');

-- ============================================================
-- WAREHOUSE LOCATIONS
-- ============================================================
CREATE TABLE warehouse_locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id   UUID NOT NULL REFERENCES seller_profiles(id),
  label       VARCHAR(100),
  address     TEXT NOT NULL,
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  pincode     VARCHAR(10) NOT NULL,
  latitude    DECIMAL(10,8),
  longitude   DECIMAL(11,8),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LISTINGS
-- ============================================================
CREATE TABLE listings (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id                 UUID NOT NULL REFERENCES seller_profiles(id),
  sector_id                 UUID NOT NULL REFERENCES sectors(id),
  title                     VARCHAR(500) NOT NULL,
  description               TEXT,
  dead_stock_type           VARCHAR(30) CHECK (dead_stock_type IN ('excess','near_expiry','obsolete','seasonal','returns','damaged_packaging')),
  condition_grade           CHAR(1) CHECK (condition_grade IN ('A','B','C','D')),
  lot_type                  VARCHAR(20) CHECK (lot_type IN ('full_lot','partial','per_unit')),
  total_quantity            INTEGER NOT NULL CHECK (total_quantity > 0),
  available_quantity        INTEGER NOT NULL,
  moq                       INTEGER DEFAULT 1,
  unit                      VARCHAR(50),
  price_type                VARCHAR(20) NOT NULL CHECK (price_type IN ('fixed','offer','auction','flash')),
  asking_price              DECIMAL(14,2) NOT NULL CHECK (asking_price > 0),
  floor_price               DECIMAL(14,2),
  reserve_price             DECIMAL(14,2),
  mrp                       DECIMAL(14,2),
  cost_price_enc            BYTEA, -- encrypted — never returned to buyers
  sector_specific_fields    JSONB DEFAULT '{}',
  images                    TEXT[] DEFAULT '{}',
  video_url                 TEXT,
  warehouse_location_id     UUID REFERENCES warehouse_locations(id),
  state                     VARCHAR(100) NOT NULL,
  city                      VARCHAR(100) NOT NULL,
  urgency_days              INTEGER,
  urgency_score             DECIMAL(6,5) DEFAULT 0,
  expiry_date               DATE,
  is_featured               BOOLEAN DEFAULT FALSE,
  featured_until            TIMESTAMPTZ,
  is_urgent_badge           BOOLEAN DEFAULT FALSE,
  status                    VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','pending_review','live','paused','sold','expired','delisted')),
  views_count               INTEGER DEFAULT 0,
  inquiries_count           INTEGER DEFAULT 0,
  watchlist_count           INTEGER DEFAULT 0,
  ai_generated_description  BOOLEAN DEFAULT FALSE,
  listing_source            VARCHAR(20) DEFAULT 'ai_prompt',
  flash_sale_ends_at        TIMESTAMPTZ,
  auction_ends_at           TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ
);
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_listings_sector ON listings(sector_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_state_city ON listings(state, city);
CREATE INDEX idx_listings_urgency_score ON listings(urgency_score DESC);
CREATE INDEX idx_listings_price ON listings(asking_price);
CREATE INDEX idx_listings_expiry ON listings(expiry_date);
CREATE INDEX idx_listings_condition ON listings(condition_grade);

-- ============================================================
-- DELIVERY ADDRESSES
-- ============================================================
CREATE TABLE delivery_addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id    UUID NOT NULL REFERENCES buyer_profiles(id),
  label       VARCHAR(100),
  name        VARCHAR(255) NOT NULL,
  phone       VARCHAR(15) NOT NULL,
  address     TEXT NOT NULL,
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  pincode     VARCHAR(10) NOT NULL,
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_delivery_addr_buyer ON delivery_addresses(buyer_id);

-- ============================================================
-- ESCROW ACCOUNTS
-- ============================================================
CREATE TABLE escrow_accounts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id              UUID UNIQUE,
  amount                DECIMAL(14,2) NOT NULL,
  commission            DECIMAL(14,2) NOT NULL,
  gst_on_commission     DECIMAL(14,2) NOT NULL,
  tcs_amount            DECIMAL(14,2) NOT NULL,
  net_payout            DECIMAL(14,2) NOT NULL,
  status                VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','funded','held','released','refunded','disputed')),
  razorpay_order_id     VARCHAR(100),
  razorpay_payment_id   VARCHAR(100),
  razorpay_signature    VARCHAR(255),
  release_triggered_by  VARCHAR(30),
  auto_release_at       TIMESTAMPTZ,
  funded_at             TIMESTAMPTZ,
  released_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER escrow_updated_at BEFORE UPDATE ON escrow_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number        VARCHAR(20) UNIQUE NOT NULL,
  buyer_id            UUID NOT NULL REFERENCES buyer_profiles(id),
  seller_id           UUID NOT NULL REFERENCES seller_profiles(id),
  listing_id          UUID NOT NULL REFERENCES listings(id),
  quantity            INTEGER NOT NULL,
  unit_price          DECIMAL(14,2) NOT NULL,
  subtotal            DECIMAL(14,2) NOT NULL,
  platform_commission DECIMAL(14,2),
  commission_rate     DECIMAL(6,5),
  gst_amount          DECIMAL(14,2),
  freight_amount      DECIMAL(14,2) DEFAULT 0,
  total_amount        DECIMAL(14,2) NOT NULL,
  status              VARCHAR(30) DEFAULT 'draft',
  payment_method      VARCHAR(20),
  escrow_id           UUID REFERENCES escrow_accounts(id),
  delivery_address_id UUID REFERENCES delivery_addresses(id),
  logistics_type      VARCHAR(30) DEFAULT 'seller_ship',
  shipment_id         UUID,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_listing ON orders(listing_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

ALTER TABLE escrow_accounts ADD CONSTRAINT fk_escrow_order FOREIGN KEY (order_id) REFERENCES orders(id);

-- ============================================================
-- NEGOTIATIONS
-- ============================================================
CREATE TABLE negotiations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id      UUID NOT NULL REFERENCES listings(id),
  buyer_id        UUID NOT NULL REFERENCES buyer_profiles(id),
  seller_id       UUID NOT NULL REFERENCES seller_profiles(id),
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','accepted','rejected','expired','converted')),
  round_count     INTEGER DEFAULT 0,
  current_price   DECIMAL(14,2) NOT NULL,
  last_offer_by   VARCHAR(10) CHECK (last_offer_by IN ('buyer','seller')),
  expires_at      TIMESTAMPTZ,
  order_id        UUID REFERENCES orders(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE negotiation_rounds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  negotiation_id  UUID NOT NULL REFERENCES negotiations(id),
  offered_by      VARCHAR(10) NOT NULL CHECK (offered_by IN ('buyer','seller')),
  offered_price   DECIMAL(14,2) NOT NULL,
  message         TEXT,
  ai_suggested    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_negotiations_listing ON negotiations(listing_id);
CREATE INDEX idx_negotiations_buyer ON negotiations(buyer_id);

-- ============================================================
-- AUCTIONS
-- ============================================================
CREATE TABLE auction_bids (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id    UUID NOT NULL REFERENCES listings(id),
  buyer_id      UUID NOT NULL REFERENCES buyer_profiles(id),
  amount        DECIMAL(14,2) NOT NULL,
  is_winning    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_auction_bids_listing ON auction_bids(listing_id);
CREATE INDEX idx_auction_bids_amount ON auction_bids(listing_id, amount DESC);

-- ============================================================
-- SHIPMENTS
-- ============================================================
CREATE TABLE shipments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders(id),
  logistics_provider  VARCHAR(50),
  awb_number          VARCHAR(100),
  tracking_url        TEXT,
  status              VARCHAR(30) DEFAULT 'pending',
  pickup_date         DATE,
  expected_delivery   DATE,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_awb ON shipments(awb_number);

ALTER TABLE orders ADD CONSTRAINT fk_order_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL UNIQUE REFERENCES orders(id),
  invoice_number      VARCHAR(30) UNIQUE NOT NULL,
  invoice_date        DATE NOT NULL,
  seller_gstin        VARCHAR(20),
  buyer_gstin         VARCHAR(20),
  taxable_value       DECIMAL(14,2) NOT NULL,
  gst_rate            DECIMAL(5,4) NOT NULL,
  cgst                DECIMAL(14,2) DEFAULT 0,
  sgst                DECIMAL(14,2) DEFAULT 0,
  igst                DECIMAL(14,2) DEFAULT 0,
  tcs_amount          DECIMAL(14,2) DEFAULT 0,
  total_amount        DECIMAL(14,2) NOT NULL,
  hsn_code            VARCHAR(20),
  supply_type         VARCHAR(20) CHECK (supply_type IN ('intrastate','interstate')),
  pdf_url             TEXT,
  emailed_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

-- ============================================================
-- PAYOUTS
-- ============================================================
CREATE TABLE payouts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id           UUID NOT NULL REFERENCES seller_profiles(id),
  order_id            UUID NOT NULL REFERENCES orders(id),
  gross_amount        DECIMAL(14,2) NOT NULL,
  commission          DECIMAL(14,2) NOT NULL,
  gst_on_commission   DECIMAL(14,2) NOT NULL,
  tcs_amount          DECIMAL(14,2) NOT NULL,
  tds_amount          DECIMAL(14,2) DEFAULT 0,
  net_amount          DECIMAL(14,2) NOT NULL,
  status              VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','processing','completed','failed','held')),
  razorpay_payout_id  VARCHAR(100),
  scheduled_for       TIMESTAMPTZ NOT NULL,
  processed_at        TIMESTAMPTZ,
  failure_reason      TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER payouts_updated_at BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_payouts_seller ON payouts(seller_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- ============================================================
-- DISPUTES
-- ============================================================
CREATE TABLE disputes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders(id),
  raised_by_user_id   UUID NOT NULL REFERENCES users(id),
  reason              VARCHAR(100) NOT NULL,
  description         TEXT NOT NULL,
  evidence_urls       TEXT[] DEFAULT '{}',
  status              VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open','under_review','pending_evidence','resolved','escalated','closed')),
  resolution          VARCHAR(30) DEFAULT 'pending' CHECK (resolution IN ('release_to_seller','refund_buyer','split','pending')),
  resolution_notes    TEXT,
  resolved_by         UUID REFERENCES users(id),
  sla_deadline        TIMESTAMPTZ NOT NULL,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER disputes_updated_at BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_disputes_order ON disputes(order_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- ============================================================
-- WATCHLIST
-- ============================================================
CREATE TABLE watchlist (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id    UUID NOT NULL REFERENCES buyer_profiles(id),
  listing_id  UUID NOT NULL REFERENCES listings(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(buyer_id, listing_id)
);
CREATE INDEX idx_watchlist_buyer ON watchlist(buyer_id);

-- ============================================================
-- AI LOGS
-- ============================================================
CREATE TABLE ai_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),
  action_type     VARCHAR(50) NOT NULL,
  model           VARCHAR(100) NOT NULL,
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  cost_usd        DECIMAL(10,6) DEFAULT 0,
  latency_ms      INTEGER,
  success         BOOLEAN DEFAULT TRUE,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_logs_user ON ai_logs(user_id);
CREATE INDEX idx_ai_logs_action ON ai_logs(action_type);
CREATE INDEX idx_ai_logs_created ON ai_logs(created_at DESC);
CREATE INDEX idx_ai_logs_cost ON ai_logs(created_at DESC, cost_usd);

-- ============================================================
-- AI CREDITS
-- ============================================================
CREATE TABLE ai_credit_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id    UUID NOT NULL REFERENCES buyer_profiles(id),
  action      VARCHAR(30) NOT NULL CHECK (action IN ('earned','spent','purchased','refunded')),
  amount      INTEGER NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_credits_buyer ON ai_credit_transactions(buyer_id);

-- ============================================================
-- REFERRALS
-- ============================================================
CREATE TABLE referral_clicks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_code VARCHAR(20) NOT NULL,
  listing_id    UUID REFERENCES listings(id),
  clicked_by_ip VARCHAR(50),
  converted     BOOLEAN DEFAULT FALSE,
  order_id      UUID REFERENCES orders(id),
  commission_earned DECIMAL(10,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_referral_clicks_code ON referral_clicks(referral_code);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  VARCHAR(50),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(50) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  data            JSONB DEFAULT '{}',
  channel         VARCHAR(20) CHECK (channel IN ('push','whatsapp','sms','email','in_app')),
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','read')),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(user_id, status);

-- ============================================================
-- SAVED SEARCHES
-- ============================================================
CREATE TABLE saved_searches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id    UUID NOT NULL REFERENCES buyer_profiles(id),
  name        VARCHAR(100) NOT NULL,
  filters     JSONB NOT NULL,
  notify      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_saved_searches_buyer ON saved_searches(buyer_id);

-- ============================================================
-- Invoice sequence counter
-- ============================================================
CREATE SEQUENCE invoice_seq START 1;
