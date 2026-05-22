// ============================================================
// NirmalMandi — Shared Types
// All enums, interfaces, and type definitions shared across services
// ============================================================

export type UserRole = 'buyer' | 'seller' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'suspended' | 'banned';
export type Language = 'en' | 'hi';

export interface User {
  id: string;
  phone: string;
  email?: string;
  name: string;
  role: UserRole;
  language_preference: Language;
  referral_code: string;
  referred_by?: string;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export type VerificationTier = 'unverified' | 'basic' | 'verified' | 'premium';
export type KycStatus = 'pending' | 'in_review' | 'approved' | 'rejected';
export type BusinessType = 'manufacturer' | 'distributor' | 'retailer' | 'wholesaler';

export interface SellerProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_type: BusinessType;
  gst_number: string;
  pan_number?: string;
  msme_number?: string;
  verification_tier: VerificationTier;
  performance_score: number;
  dispute_rate: number;
  fulfillment_rate: number;
  response_rate: number;
  total_gmv: number;
  bank_account_id?: string;
  kyc_status: KycStatus;
}

export type BuyerTier = 'tier1' | 'tier2' | 'tier3';

export interface BuyerProfile {
  id: string;
  user_id: string;
  business_name?: string;
  gst_number?: string;
  verification_tier: BuyerTier;
  sector_interests: string[];
  total_purchases: number;
  referral_earnings: number;
  ai_credits_balance: number;
}

// ---- Listings ----
export type DeadStockType =
  | 'excess'
  | 'near_expiry'
  | 'obsolete'
  | 'seasonal'
  | 'returns'
  | 'damaged_packaging';

export type ConditionGrade = 'A' | 'B' | 'C' | 'D';
export type LotType = 'full_lot' | 'partial' | 'per_unit';
export type PriceType = 'fixed' | 'offer' | 'auction' | 'flash';
export type ListingStatus =
  | 'draft'
  | 'pending_review'
  | 'live'
  | 'paused'
  | 'sold'
  | 'expired'
  | 'delisted';
export type ListingSource = 'ai_prompt' | 'manual';

export interface Listing {
  id: string;
  seller_id: string;
  sector_id: string;
  title: string;
  description?: string;
  dead_stock_type: DeadStockType;
  condition_grade: ConditionGrade;
  lot_type: LotType;
  total_quantity: number;
  moq: number;
  unit: string;
  price_type: PriceType;
  asking_price: number;
  floor_price?: number;
  reserve_price?: number;
  mrp?: number;
  cost_price?: number; // internal only
  sector_specific_fields: Record<string, unknown>;
  images: string[];
  video_url?: string;
  warehouse_location_id?: string;
  state: string;
  city: string;
  urgency_days?: number;
  urgency_score?: number;
  expiry_date?: string;
  is_featured: boolean;
  is_urgent_badge: boolean;
  status: ListingStatus;
  views_count: number;
  inquiries_count: number;
  watchlist_count: number;
  listing_source: ListingSource;
  flash_sale_ends_at?: Date;
  auction_ends_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// ---- Orders ----
export type OrderStatus =
  | 'draft'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'disputed'
  | 'cancelled'
  | 'completed';

export type PaymentMethod = 'upi' | 'neft' | 'rtgs' | 'card';
export type LogisticsType = 'seller_ship' | 'platform_logistics' | 'buyer_pickup';

export interface Order {
  id: string;
  order_number: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  platform_commission: number;
  commission_rate: number;
  gst_amount: number;
  freight_amount: number;
  total_amount: number;
  status: OrderStatus;
  payment_method?: PaymentMethod;
  escrow_id?: string;
  delivery_address_id?: string;
  logistics_type: LogisticsType;
  shipment_id?: string;
  created_at: Date;
  updated_at: Date;
}

// ---- Escrow ----
export type EscrowStatus = 'pending' | 'funded' | 'held' | 'released' | 'refunded' | 'disputed';

export interface EscrowAccount {
  id: string;
  order_id: string;
  amount: number;
  commission: number;
  gst_on_commission: number;
  tcs_amount: number;
  net_payout: number;
  status: EscrowStatus;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  release_triggered_by?: 'buyer_confirmation' | 'auto_timer' | 'admin';
  funded_at?: Date;
  released_at?: Date;
  created_at: Date;
}

// ---- Sectors ----
export interface Sector {
  id: string;
  name: string;
  slug: string;
  parent_id?: string;
  schema_definition: Record<string, unknown>;
  is_ai_generated: boolean;
  admin_approved: boolean;
  compliance_rules: Record<string, unknown>;
  logistics_config: Record<string, unknown>;
  pricing_mode_default: PriceType;
  buyer_verification_requirements: Record<string, unknown>;
  status: 'active' | 'inactive';
}

// ---- Disputes ----
export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'pending_evidence'
  | 'resolved'
  | 'escalated'
  | 'closed';

export type DisputeResolution =
  | 'release_to_seller'
  | 'refund_buyer'
  | 'split'
  | 'pending';

export interface Dispute {
  id: string;
  order_id: string;
  raised_by: string;
  reason: string;
  description: string;
  evidence_urls: string[];
  status: DisputeStatus;
  resolution: DisputeResolution;
  resolution_notes?: string;
  sla_deadline: Date;
  resolved_at?: Date;
  created_at: Date;
}

// ---- AI ----
export interface AiLog {
  id: string;
  user_id: string;
  action_type:
    | 'listing_prompt'
    | 'caption_gen'
    | 'agent_message'
    | 'pricing_rec'
    | 'doc_extraction'
    | 'vision_analysis';
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  success: boolean;
  error_message?: string;
  created_at: Date;
}

// ---- Commission rates by sector ----
export const COMMISSION_RATES: Record<string, number> = {
  automobiles: 0.015,    // 1.5%
  clothing: 0.03,        // 3%
  furniture: 0.03,       // 3%
  fmcg: 0.025,          // 2.5%
  pharma: 0.02,         // 2%
  software: 0.05,       // 5%
  machinery: 0.02,      // 2%
  default: 0.03,        // 3%
};

export const GST_RATES: Record<string, number> = {
  automobiles: 0.28,
  clothing: 0.05,
  furniture: 0.18,
  fmcg: 0.12,
  pharma: 0.12,
  software: 0.18,
  machinery: 0.18,
  default: 0.18,
};

export const TCS_RATE = 0.01; // 1% Tax Collected at Source
export const GST_ON_COMMISSION = 0.18; // 18% GST on platform commission
export const TDS_THRESHOLD = 30000; // TDS applicable above ₹30,000 per year per seller

// ---- JWT ----
export interface JwtPayload {
  sub: string;       // user id
  phone: string;
  role: UserRole;
  profile_id: string; // buyer_profile.id or seller_profile.id
  iat: number;
  exp: number;
}

// ---- API responses ----
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

export function successResponse<T>(data: T, message?: string): ApiSuccess<T> {
  return { success: true, data, message };
}

export function errorResponse(error: string, code?: string, details?: unknown): ApiError {
  return { success: false, error, code, details };
}
