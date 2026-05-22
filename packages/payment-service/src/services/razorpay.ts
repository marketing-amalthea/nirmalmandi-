/**
 * Razorpay integration service.
 * Uses Route (nodal account) for escrow — buyer pays into nodal,
 * seller receives via linked account transfer on release.
 */
import Razorpay from 'razorpay';
import crypto from 'crypto';

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export interface CreateOrderParams {
  amount: number; // in paisa
  orderId: string;
  listingId: string;
  sellerId: string;
}

export async function createRazorpayOrder(params: CreateOrderParams) {
  const order = await razorpay.orders.create({
    amount: params.amount,
    currency: 'INR',
    receipt: params.orderId,
    notes: {
      listing_id: params.listingId,
      seller_id: params.sellerId,
      platform: 'nirmalmandi',
    },
    // Escrow: payment held in nodal account until release
    transfers: [], // transfers added on release, not at order creation
  });
  return order;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Transfer funds from nodal account to seller linked account.
 * Called after buyer confirms delivery OR auto-timer expires.
 */
export async function transferToSeller(params: {
  paymentId: string;
  sellerLinkedAccountId: string;
  amount: number; // in paisa — net payout after commission
  orderId: string;
}) {
  const transfer = await (razorpay.payments as any).transfer(params.paymentId, {
    transfers: [
      {
        account: params.sellerLinkedAccountId,
        amount: params.amount,
        currency: 'INR',
        notes: {
          order_id: params.orderId,
          platform: 'nirmalmandi',
          type: 'seller_payout',
        },
        linked_account_notes: ['order_id'],
        on_hold: 0,
      },
    ],
  });
  return transfer;
}

/**
 * Issue refund to buyer — called when dispute resolved in buyer's favour
 * or seller cancels before shipment.
 */
export async function issueRefund(paymentId: string, amount: number, reason: string) {
  const refund = await (razorpay.payments as any).refund(paymentId, {
    amount,
    notes: { reason, platform: 'nirmalmandi' },
    speed: 'normal',
  });
  return refund;
}
