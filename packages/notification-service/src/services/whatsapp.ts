/**
 * WhatsApp notification via Twilio WhatsApp Business API.
 * All messages go through approved templates for business-initiated sessions.
 */
import twilio from 'twilio';
import { logger } from '@nirmalmandi/shared';

let client: ReturnType<typeof twilio> | null = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID?.startsWith('AC')) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN!);
  } else {
    logger.warn('Twilio not configured — WhatsApp disabled');
  }
} catch {
  logger.warn('Twilio init failed — WhatsApp disabled');
}

const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM || '+910000000000'}`;

export interface WhatsAppMessage {
  to: string; // phone number with country code e.g. +919876543210
  template: string;
  variables: string[];
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<void> {
  if (!client || process.env.NODE_ENV === 'development') {
    logger.info('[DEV] WhatsApp skipped', { to: msg.to, template: msg.template });
    return;
  }
  try {
    // Build body from template + variables (Twilio content template SID in prod)
    const body = interpolateTemplate(msg.template, msg.variables);
    await client.messages.create({
      from: FROM,
      to: `whatsapp:${msg.to}`,
      body,
    });
  } catch (err) {
    logger.error('WhatsApp send failed', { to: msg.to, error: err });
    throw err;
  }
}

function interpolateTemplate(template: string, vars: string[]): string {
  return vars.reduce((t, v, i) => t.replace(`{{${i + 1}}}`, v), template);
}

// ── Pre-defined message templates ─────────────────────────────────

export const Templates = {
  ORDER_PLACED: 'आपका ऑर्डर {{1}} सफलतापूर्वक प्लेस हो गया। राशि: ₹{{2}}। NirmalMandi',
  ORDER_CONFIRMED: 'विक्रेता ने आपका ऑर्डर {{1}} कन्फर्म किया। जल्द भेजा जाएगा।',
  ORDER_SHIPPED: 'आपका सामान भेज दिया गया। AWB: {{1}}। ट्रैक करें: {{2}}',
  ORDER_DELIVERED: 'डिलीवरी हो गई! ऑर्डर {{1}} रिसीव करने की पुष्टि करें: {{2}}',
  PAYMENT_RELEASED: '₹{{1}} आपके खाते में ट्रांसफर हो गए (ऑर्डर {{2}})।',
  AUCTION_OUTBID: 'आपकी बोली पीछे हो गई। {{1}} पर अभी बोली लगाएं: {{2}}',
  AUCTION_WON: 'बधाई! आपने {{1}} की नीलामी जीती। ₹{{2}} में।',
  NEGOTIATION_COUNTER: 'विक्रेता ने काउंटर ऑफर दिया: ₹{{1}} ({{2}} के लिए)।',
  DISPUTE_RAISED: 'विवाद {{1}} दर्ज हुआ। हमारी टीम 24 घंटे में संपर्क करेगी।',
  KYC_APPROVED: 'आपका KYC अनुमोदित हो गया। अब आप बेच सकते हैं!',
  LISTING_APPROVED: 'लिस्टिंग "{{1}}" लाइव हो गई।',
  LOW_STOCK_ALERT: 'आपकी लिस्टिंग "{{1}}" में केवल {{2}} इकाइयां बचीं।',
  ADMIN_BROADCAST: '{{1}}: {{2}} — NirmalMandi',
};
