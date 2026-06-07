-- ============================================================
-- NirmalMandi — Migration 003: Watchlist table + price-drop tracking
-- Run after 002_missing_columns.sql
-- ============================================================

-- Proper watchlist table (replaces watchlist_listing_ids array approach)
CREATE TABLE IF NOT EXISTS watchlist (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id          UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  listing_id        UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  price_at_save     DECIMAL(14,2),
  last_alert_sent_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (buyer_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_buyer      ON watchlist(buyer_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_listing    ON watchlist(listing_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_price_drop ON watchlist(price_at_save) WHERE price_at_save IS NOT NULL;

-- Unique constraint on shipments.order_id (one shipment per order)
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'booked',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipments_order_id_key') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_order_id_key UNIQUE (order_id);
  END IF;
END $$;

-- Add seller_pincode to listings (needed for accurate freight estimates)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS seller_pincode VARCHAR(10);

-- Backfill seller_pincode from seller_profiles
UPDATE listings l
SET seller_pincode = sp.pincode
FROM seller_profiles sp
WHERE l.seller_id = sp.id
  AND l.seller_pincode IS NULL
  AND sp.pincode IS NOT NULL;
