import { COMMISSION_RATES, GST_ON_COMMISSION, TCS_RATE } from '../types';

export interface PayoutCalculation {
  gross_amount: number;
  commission_rate: number;
  commission: number;
  gst_on_commission: number;
  tcs_amount: number;
  net_payout: number;
}

/**
 * Calculate seller payout after commission, GST on commission, and TCS.
 * commission and tcs are deducted from seller payout, not from buyer payment.
 */
export function calculatePayout(amount: number, sectorSlug: string): PayoutCalculation {
  const commission_rate = COMMISSION_RATES[sectorSlug] ?? COMMISSION_RATES.default;
  const commission = Math.round(amount * commission_rate * 100) / 100;
  const gst_on_commission = Math.round(commission * GST_ON_COMMISSION * 100) / 100;
  const tcs_amount = Math.round(amount * TCS_RATE * 100) / 100;
  const net_payout = Math.round((amount - commission - gst_on_commission - tcs_amount) * 100) / 100;

  return {
    gross_amount: amount,
    commission_rate,
    commission,
    gst_on_commission,
    tcs_amount,
    net_payout,
  };
}

export interface GstCalculation {
  taxable_value: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_gst: number;
  total_value: number;
}

/**
 * Compute GST based on buyer and seller state.
 * Intrastate → CGST + SGST (split equally).
 * Interstate → IGST.
 */
export function computeGST(
  taxableValue: number,
  gstRate: number,
  buyerState: string,
  sellerState: string
): GstCalculation {
  const isIntrastate = buyerState.toUpperCase() === sellerState.toUpperCase();
  const totalGst = Math.round(taxableValue * gstRate * 100) / 100;

  if (isIntrastate) {
    const half = Math.round(totalGst / 2 * 100) / 100;
    return {
      taxable_value: taxableValue,
      gst_rate: gstRate,
      cgst: half,
      sgst: totalGst - half, // handle rounding
      igst: 0,
      total_gst: totalGst,
      total_value: taxableValue + totalGst,
    };
  }

  return {
    taxable_value: taxableValue,
    gst_rate: gstRate,
    cgst: 0,
    sgst: 0,
    igst: totalGst,
    total_gst: totalGst,
    total_value: taxableValue + totalGst,
  };
}
