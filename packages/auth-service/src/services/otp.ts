import twilio from 'twilio';
import { logger } from '@nirmalmandi/shared';

let client: twilio.Twilio | null = null;

function getTwilio() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

export async function sendOtp(phone: string, otp: string): Promise<void> {
  const message = `Your NirmalMandi OTP is: ${otp}. Valid for 2 minutes. Do not share with anyone.`;

  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    logger.info(`[DEV] OTP for ${phone.slice(0, 6)}****: ${otp}`);
    return;
  }

  try {
    await getTwilio().messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: `+91${phone}`,
    });
  } catch (err) {
    logger.error('Failed to send OTP via Twilio', { error: err });
    throw new Error('Failed to send OTP');
  }
}
