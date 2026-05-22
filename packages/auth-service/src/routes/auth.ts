import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  query, queryOne, withTransaction,
  setOtp, verifyAndDeleteOtp, setSession, deleteSession,
  otpRateLimiter, rateLimiter,
  authenticate,
  generateReferralCode,
  phoneSchema, gstSchema,
  successResponse, errorResponse,
  logger,
} from '@nirmalmandi/shared';
import { sendOtp } from '../services/otp';
import { validateGstin } from '../services/gstn';
import { verifyBankAccount } from '../services/kyc';

export const authRouter = Router();

// ── POST /auth/otp/send ──────────────────────────────────────
authRouter.post(
  '/otp/send',
  otpRateLimiter(),
  async (req: Request, res: Response) => {
    const schema = z.object({ phone: phoneSchema });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));
      return;
    }
    const { phone } = parsed.data;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await setOtp(phone, otp, 120);
    await sendOtp(phone, otp);
    logger.info('OTP sent', { phone: phone.slice(0, 6) + '****' });
    res.json(successResponse({ message: 'OTP sent' }));
  }
);

// ── POST /auth/otp/verify ────────────────────────────────────
authRouter.post(
  '/otp/verify',
  rateLimiter(10),
  async (req: Request, res: Response) => {
    const schema = z.object({ phone: phoneSchema, otp: z.string().length(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));
      return;
    }
    const { phone, otp } = parsed.data;
    const valid = await verifyAndDeleteOtp(phone, otp);
    if (!valid) {
      res.status(401).json(errorResponse('Invalid or expired OTP', 'OTP_INVALID'));
      return;
    }

    // Check if user exists
    const user = await queryOne<{ id: string; role: string; name: string; status: string }>(
      'SELECT id, role, name, status FROM users WHERE phone = $1 AND deleted_at IS NULL',
      [phone]
    );

    if (!user) {
      // New user — return token-less response, frontend routes to registration
      res.json(successResponse({ registered: false, phone }));
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json(errorResponse('Account suspended or banned', 'ACCOUNT_INACTIVE'));
      return;
    }

    // Get profile id
    const profileRow = user.role === 'seller'
      ? await queryOne<{ id: string }>('SELECT id FROM seller_profiles WHERE user_id = $1', [user.id])
      : await queryOne<{ id: string }>('SELECT id FROM buyer_profiles WHERE user_id = $1', [user.id]);

    const tokens = generateTokens(user.id, phone, user.role as never, profileRow?.id ?? user.id);
    await setSession(user.id, tokens.refresh_token, 60 * 60 * 24 * 30);

    res.json(successResponse({ registered: true, ...tokens, user: { id: user.id, name: user.name, role: user.role } }));
  }
);

// ── POST /auth/register/buyer ────────────────────────────────
authRouter.post(
  '/register/buyer',
  rateLimiter(5),
  async (req: Request, res: Response) => {
    const schema = z.object({
      phone: phoneSchema,
      name: z.string().min(2).max(255),
      business_name: z.string().min(2).max(255).optional(),
      gst_number: gstSchema.optional(),
      state: z.string().min(2),
      city: z.string().min(2),
      sector_interests: z.array(z.string().uuid()).default([]),
      referral_code: z.string().optional(),
      language_preference: z.enum(['en', 'hi']).default('hi'),
      otp_verified_phone: phoneSchema, // must match phone — frontend sends after OTP verify
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));
      return;
    }
    const data = parsed.data;

    if (data.phone !== data.otp_verified_phone) {
      res.status(400).json(errorResponse('Phone mismatch', 'PHONE_MISMATCH'));
      return;
    }

    // Validate GST if provided
    if (data.gst_number) {
      const gstValid = await validateGstin(data.gst_number);
      if (!gstValid) {
        res.status(400).json(errorResponse('GST number is invalid or inactive', 'GST_INVALID'));
        return;
      }
    }

    // Resolve referral
    let referredBy: string | null = null;
    if (data.referral_code) {
      const ref = await queryOne<{ id: string }>('SELECT id FROM users WHERE referral_code = $1', [data.referral_code]);
      referredBy = ref?.id ?? null;
    }

    const result = await withTransaction(async (client) => {
      const userId = uuidv4();
      const referralCode = generateReferralCode(data.name);

      await client.query(
        `INSERT INTO users (id, phone, name, role, language_preference, referral_code, referred_by)
         VALUES ($1,$2,$3,'buyer',$4,$5,$6)`,
        [userId, data.phone, data.name, data.language_preference, referralCode, referredBy]
      );

      const profileId = uuidv4();
      await client.query(
        `INSERT INTO buyer_profiles (id, user_id, business_name, gst_number, sector_interests, ai_credits_balance)
         VALUES ($1,$2,$3,$4,$5, 50)`,
        [profileId, userId, data.business_name ?? null, data.gst_number ?? null, data.sector_interests]
      );

      return { userId, profileId, referralCode };
    });

    const tokens = generateTokens(result.userId, data.phone, 'buyer', result.profileId);
    await setSession(result.userId, tokens.refresh_token, 60 * 60 * 24 * 30);

    logger.info('Buyer registered', { userId: result.userId });
    res.status(201).json(successResponse({
      ...tokens,
      user: { id: result.userId, name: data.name, role: 'buyer', referral_code: result.referralCode },
    }, 'Registration successful'));
  }
);

// ── POST /auth/register/seller ───────────────────────────────
authRouter.post(
  '/register/seller',
  rateLimiter(5),
  async (req: Request, res: Response) => {
    const schema = z.object({
      phone: phoneSchema,
      name: z.string().min(2).max(255),
      business_name: z.string().min(2).max(255),
      business_type: z.enum(['manufacturer', 'distributor', 'retailer', 'wholesaler']),
      gst_number: gstSchema,
      language_preference: z.enum(['en', 'hi']).default('hi'),
      otp_verified_phone: phoneSchema,
      bank_account_number: z.string().min(9).max(18),
      ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));
      return;
    }
    const data = parsed.data;

    if (data.phone !== data.otp_verified_phone) {
      res.status(400).json(errorResponse('Phone mismatch', 'PHONE_MISMATCH'));
      return;
    }

    // Validate GST
    const gstValid = await validateGstin(data.gst_number);
    if (!gstValid) {
      res.status(400).json(errorResponse('GST number is invalid or inactive', 'GST_INVALID'));
      return;
    }

    // Penny drop bank verification
    const bankVerified = await verifyBankAccount(
      data.bank_account_number,
      data.ifsc,
      data.business_name
    );
    if (!bankVerified.valid) {
      res.status(400).json(errorResponse('Bank account verification failed', 'BANK_INVALID'));
      return;
    }

    const result = await withTransaction(async (client) => {
      const userId = uuidv4();
      const referralCode = generateReferralCode(data.business_name);

      await client.query(
        `INSERT INTO users (id, phone, name, role, language_preference, referral_code)
         VALUES ($1,$2,$3,'seller',$4,$5)`,
        [userId, data.phone, data.name, data.language_preference, referralCode]
      );

      const profileId = uuidv4();
      await client.query(
        `INSERT INTO seller_profiles (id, user_id, business_name, business_type, gst_number, verification_tier)
         VALUES ($1,$2,$3,$4,$5,'basic')`,
        [profileId, userId, data.business_name, data.business_type, data.gst_number]
      );

      // Store encrypted bank account
      const bankId = uuidv4();
      await client.query(
        `INSERT INTO bank_accounts (id, seller_id, account_number_enc, ifsc, account_holder_name, is_verified, penny_drop_status)
         VALUES ($1,$2,pgp_sym_encrypt($3,$4),$5,$6,true,'verified')`,
        [bankId, profileId, data.bank_account_number, process.env.DB_ENCRYPTION_KEY || 'nm-enc-key', data.ifsc, data.business_name]
      );

      await client.query(
        'UPDATE seller_profiles SET bank_account_id = $1 WHERE id = $2',
        [bankId, profileId]
      );

      return { userId, profileId, referralCode };
    });

    const tokens = generateTokens(result.userId, data.phone, 'seller', result.profileId);
    await setSession(result.userId, tokens.refresh_token, 60 * 60 * 24 * 30);

    logger.info('Seller registered', { userId: result.userId });
    res.status(201).json(successResponse({
      ...tokens,
      user: { id: result.userId, name: data.name, role: 'seller', referral_code: result.referralCode },
    }, 'Registration successful'));
  }
);

// ── POST /auth/refresh ───────────────────────────────────────
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    res.status(400).json(errorResponse('refresh_token required'));
    return;
  }
  try {
    const publicKey = Buffer.from(process.env.JWT_PUBLIC_KEY || '', 'base64').toString();
    const payload = jwt.verify(refresh_token, publicKey, { algorithms: ['RS256'] }) as { sub: string; phone: string; role: string; profile_id: string };
    const tokens = generateTokens(payload.sub, payload.phone, payload.role as never, payload.profile_id);
    await setSession(payload.sub, tokens.refresh_token, 60 * 60 * 24 * 30);
    res.json(successResponse(tokens));
  } catch {
    res.status(401).json(errorResponse('Invalid refresh token'));
  }
});

// ── POST /auth/logout ────────────────────────────────────────
authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
  await deleteSession(req.user!.sub);
  res.json(successResponse({ message: 'Logged out' }));
});

// ── Helpers ──────────────────────────────────────────────────
function generateTokens(userId: string, phone: string, role: string, profileId: string) {
  const privateKey = Buffer.from(process.env.JWT_PRIVATE_KEY || '', 'base64').toString();
  const access_token = jwt.sign(
    { sub: userId, phone, role, profile_id: profileId },
    privateKey,
    { algorithm: 'RS256', expiresIn: '24h' }
  );
  const refresh_token = jwt.sign(
    { sub: userId, phone, role, profile_id: profileId },
    privateKey,
    { algorithm: 'RS256', expiresIn: '30d' }
  );
  return { access_token, refresh_token };
}
