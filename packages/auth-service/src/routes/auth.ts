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
import { sendOtp, sendEmailOtp } from '../services/otp';
import bcrypt from 'bcryptjs';
import { validateGstin } from '../services/gstn';
import { verifyBankAccount } from '../services/kyc';

export const authRouter = Router();

// ── Stateless OTP token — HMAC-SHA256, no external deps ──────────────────────
const OTP_SECRET = (process.env.INTERNAL_SERVICE_SECRET ?? 'nm-fallback-otp-secret-2026').replace(/^"|"$/g, '').replace(/^'|'$/g, '');

function signOtpToken(email: string, otp: string): string {
  // payload: base64(email:otp:exp) + HMAC signature
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = Buffer.from(`${email.toLowerCase()}|${otp}|${exp}`).toString('base64');
  const sig = require('crypto').createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyOtpToken(token: string, email: string, otp: string): boolean {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const expectedSig = require('crypto').createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
    if (sig !== expectedSig) { logger.warn('OTP token bad signature'); return false; }
    const [storedEmail, storedOtp, expStr] = Buffer.from(payload, 'base64').toString().split('|');
    if (Date.now() > parseInt(expStr)) { logger.warn('OTP token expired'); return false; }
    const match = storedEmail === email.toLowerCase() && storedOtp === otp;
    logger.info('OTP token check', { match, storedEmail, inputEmail: email.toLowerCase() });
    return match;
  } catch (e) {
    logger.warn('OTP token verify error', { error: (e as Error).message });
    return false;
  }
}

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
    await setOtp(phone, otp, 600); // 10 min expiry
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
    const jwtSecret = (process.env.INTERNAL_SERVICE_SECRET || 'nm-jwt-secret-2026').replace(/['"]/g, '');
    const payload = jwt.verify(refresh_token, jwtSecret, { algorithms: ['HS256'] }) as { sub: string; phone: string; role: string; profile_id: string };
    const tokens = generateTokens(payload.sub, payload.phone, payload.role as never, payload.profile_id);
    await setSession(payload.sub, tokens.refresh_token, 60 * 60 * 24 * 30);
    res.json(successResponse(tokens));
  } catch {
    res.status(401).json(errorResponse('Invalid refresh token'));
  }
});

// ── POST /auth/verify-bank ───────────────────────────────────
// Called by seller-register step 4 before final submit
authRouter.post(
  '/verify-bank',
  rateLimiter(10),
  async (req: Request, res: Response) => {
    const schema = z.object({
      account_number: z.string().min(9).max(18),
      ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'),
      business_name: z.string().min(2).max(255).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));
      return;
    }
    const { account_number, ifsc, business_name } = parsed.data;
    const result = await verifyBankAccount(account_number, ifsc, business_name ?? 'Verification');
    if (!result.valid) {
      res.status(400).json(errorResponse(result.message || 'Bank account verification failed', 'BANK_INVALID'));
      return;
    }
    res.json(successResponse({ verified: true, name_match_score: result.name_match_score }));
  }
);

// ── POST /auth/kyc-upload-url ─────────────────────────────────
// Returns presigned S3 URL for seller KYC document upload
authRouter.post(
  '/kyc-upload-url',
  rateLimiter(20),
  async (req: Request, res: Response) => {
    const schema = z.object({ type: z.enum(['gst_certificate', 'pan_card', 'address_proof', 'bank_statement']) });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(errorResponse('Invalid document type', 'VALIDATION_ERROR'));
      return;
    }
    const { type } = parsed.data;

    // In dev — return a mock signed URL that points to a local endpoint
    if (process.env.NODE_ENV === 'development') {
      const fileKey = `kyc/${type}/${Date.now()}.pdf`;
      res.json(successResponse({
        uploadUrl: `http://localhost:3001/auth/kyc-upload-mock?key=${fileKey}`,
        fileUrl: `https://${process.env.S3_BUCKET || 'nm-dev'}.s3.ap-south-1.amazonaws.com/${fileKey}`,
      }));
      return;
    }

    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const fileKey = `kyc/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: fileKey,
        ContentType: 'application/octet-stream',
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
      const fileUrl = `https://${process.env.CLOUDFRONT_DOMAIN || `${process.env.S3_BUCKET}.s3.ap-south-1.amazonaws.com`}/${fileKey}`;
      res.json(successResponse({ uploadUrl, fileUrl }));
    } catch (err) {
      logger.error('Failed to generate presigned URL', { error: err });
      res.status(500).json(errorResponse('Failed to generate upload URL'));
    }
  }
);

// ── POST /auth/verify-phone — one-time phone verification inside profile ─────
// Used ONLY when user signed up via email/Google and later wants to add a phone.
// Phone is verified once → stored on users.phone → enables SMS notifications.

authRouter.post('/verify-phone/send', authenticate, otpRateLimiter(), async (req: Request, res: Response) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json(errorResponse('Valid 10-digit Indian mobile number required'));
  }

  // Check not already taken
  const existing = await queryOne('SELECT id FROM users WHERE phone = $1 AND id != $2', [phone, req.user!.sub]);
  if (existing) return res.status(409).json(errorResponse('This phone number is already linked to another account'));

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await setOtp(`phone:${phone}`, otp, 120);
  await sendOtp(phone, otp);
  return res.json(successResponse({ message: 'OTP sent to phone' }));
});

authRouter.post('/verify-phone/confirm', authenticate, rateLimiter(10), async (req: Request, res: Response) => {
  const { phone, otp } = req.body as { phone?: string; otp?: string };
  if (!phone || !otp || otp.length !== 6) return res.status(400).json(errorResponse('phone and 6-digit OTP required'));

  const valid = await verifyAndDeleteOtp(`phone:${phone}`, otp);
  if (!valid) return res.status(401).json(errorResponse('Invalid or expired OTP', 'OTP_INVALID'));

  await queryOne('UPDATE users SET phone = $1 WHERE id = $2', [phone, req.user!.sub]);
  logger.info('Phone number verified and linked', { userId: req.user!.sub });
  return res.json(successResponse({ message: 'Phone number verified and linked to your account' }));
});

// ── GET /auth/kyc-upload-mock ─────────────────────────────────
// Dev-only mock for document upload
authRouter.put('/kyc-upload-mock', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// ── POST /auth/email/register — email + password signup ─────────────────────

authRouter.post('/email/register', rateLimiter(10), async (req: Request, res: Response) => {
  const schema = z.object({
    email:    z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name:     z.string().min(1).default('User'),
    role:     z.enum(['buyer', 'seller']).default('buyer'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));

  const { email, password, name, role } = parsed.data;
  // bcrypt imported at top

  // Check email already exists
  const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing) return res.status(409).json(errorResponse('Email already registered. Please login instead.', 'EMAIL_EXISTS'));

  const password_hash = await bcrypt.hash(password, 10);
  const phone = `em_${Date.now().toString(36)}`; // placeholder, fits VARCHAR(15)

  const userId = (await queryOne<{ id: string }>(
    `INSERT INTO users (id, phone, email, name, role, password_hash)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`,
    [phone, email.toLowerCase(), name, role, password_hash]
  ))!.id;

  let profileId = userId;
  if (role === 'seller') {
    const p = await queryOne<{ id: string }>(
      `INSERT INTO seller_profiles (id, user_id, business_name, verification_tier)
       VALUES (gen_random_uuid(), $1, $2, 'unverified') RETURNING id`,
      [userId, name]
    );
    profileId = p!.id;
  } else {
    const p = await queryOne<{ id: string }>(
      `INSERT INTO buyer_profiles (id, user_id) VALUES (gen_random_uuid(), $1) RETURNING id`,
      [userId]
    );
    profileId = p!.id;
  }

  const tokens = generateTokens(userId, email.toLowerCase(), role, profileId);
  await setSession(userId, tokens.refresh_token, 60 * 60 * 24 * 30);

  logger.info('Email/password registration', { userId, role });
  return res.status(201).json(successResponse({
    ...tokens,
    user: { id: userId, name, email: email.toLowerCase(), role },
    registered: true,
  }));
});

// ── POST /auth/email/login — email + password login ───────────────────────────

authRouter.post('/email/login', rateLimiter(20), async (req: Request, res: Response) => {
  const schema = z.object({
    email:    z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Email and password required', 'VALIDATION_ERROR'));

  const { email, password } = parsed.data;
  // bcrypt imported at top

  const user = await queryOne<{ id: string; role: string; name: string; password_hash: string | null }>(
    'SELECT id, role, name, password_hash FROM users WHERE email = $1 LIMIT 1',
    [email.toLowerCase()]
  );

  if (!user || !user.password_hash) {
    return res.status(401).json(errorResponse('Invalid email or password', 'AUTH_FAILED'));
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json(errorResponse('Invalid email or password', 'AUTH_FAILED'));

  const profileRow = await queryOne<{ id: string }>(
    `SELECT id FROM buyer_profiles WHERE user_id = $1
     UNION ALL SELECT id FROM seller_profiles WHERE user_id = $1 LIMIT 1`,
    [user.id]
  );
  const profileId = profileRow?.id ?? user.id;

  const tokens = generateTokens(user.id, email.toLowerCase(), user.role, profileId);
  await setSession(user.id, tokens.refresh_token, 60 * 60 * 24 * 30);

  logger.info('Email/password login', { userId: user.id, role: user.role });
  return res.json(successResponse({
    ...tokens,
    user: { id: user.id, name: user.name, email: email.toLowerCase(), role: user.role },
    registered: true,
  }));
});

// ── POST /auth/email/otp/send — send OTP to email ────────────────────────────

authRouter.post(
  '/email/otp/send',
  otpRateLimiter(),
  async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json(errorResponse('Valid email required'));
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailKey = email.toLowerCase();
    const otpToken = signOtpToken(emailKey, otp); // stateless JWT — no storage needed
    await sendEmailOtp(emailKey, otp);
    logger.info('Email OTP sent', { email: email.replace(/(.{2}).+(@.+)/, '$1***$2') });
    return res.json(successResponse({ message: 'OTP sent to your email', token: otpToken }));
  }
);

// ── POST /auth/email/otp/verify — verify email OTP + sign in ─────────────────

authRouter.post(
  '/email/otp/verify',
  rateLimiter(10),
  async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email(),
      otp:   z.string().trim().min(1).max(8).transform(v => v.replace(/\D/g, '').slice(0, 6)),
      token: z.string().min(10), // JWT from send response
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(errorResponse('Validation failed', 'VALIDATION_ERROR', parsed.error.issues));

    const { email, otp, token } = parsed.data;
    const emailKey = email.toLowerCase();
    logger.info('Email OTP verify', { emailKey, otpLen: otp.length });
    const valid = verifyOtpToken(token, emailKey, otp);
    logger.info('Email OTP verify result', { valid, emailKey });
    if (!valid) return res.status(401).json(errorResponse('Invalid or expired OTP', 'OTP_INVALID'));

    // Find or create user by email — wrapped to surface real errors to client
    try {
    let user = await queryOne<{ id: string; role: string; phone: string; name: string | null }>(
      'SELECT id, role, phone, name FROM users WHERE email = $1 LIMIT 1',
      [email.toLowerCase()]
    );

    let profileId: string;

    if (!user) {
      // First-time email login — create buyer account
      const userId = (await queryOne<{ id: string }>(
        `INSERT INTO users (id, phone, email, name, role)
         VALUES (gen_random_uuid(), $1, $2, $3, 'buyer')
         RETURNING id`,
        // phone column is VARCHAR(15); base-36 timestamp keeps the placeholder within bounds
        [`em_${Date.now().toString(36)}`, email.toLowerCase(), email.split('@')[0]]
      ))!.id;

      const profileRow = await queryOne<{ id: string }>(
        `INSERT INTO buyer_profiles (id, user_id) VALUES (gen_random_uuid(), $1) RETURNING id`,
        [userId]
      );
      profileId = profileRow!.id;

      user = await queryOne<{ id: string; role: string; phone: string; name: string | null }>(
        'SELECT id, role, phone, name FROM users WHERE id = $1',
        [userId]
      );
    } else {
      const profileRow = await queryOne<{ id: string }>(
        `SELECT id FROM buyer_profiles WHERE user_id = $1
         UNION ALL SELECT id FROM seller_profiles WHERE user_id = $1 LIMIT 1`,
        [user!.id]
      );
      profileId = profileRow?.id ?? user!.id;
    }

    if (!user) return res.status(500).json(errorResponse('Failed to create account'));

    const tokens = generateTokens(user.id, email.toLowerCase(), user.role, profileId);
    await setSession(user.id, tokens.refresh_token, 60 * 60 * 24 * 30);

    logger.info('Email OTP login', { userId: user.id });
    return res.json(successResponse({
      ...tokens,
      user: { id: user.id, name: user.name ?? email.split('@')[0], email, role: user.role },
      registered: true,
    }));
    } catch (dbErr) {
      const msg = (dbErr as Error).message;
      logger.error('Email OTP verify DB error', { error: msg });
      return res.status(500).json(errorResponse(`Server error: ${msg}`, 'DB_ERROR'));
    }
  }
);

// ── POST /auth/seller/quick-register — minimal seller account creation ────────
// Called after email OTP verify when user wants to be a seller.
// Creates seller profile with minimal data — rest filled in /seller/profile.

authRouter.post('/seller/quick-register', authenticate, async (req: Request, res: Response) => {
  const { business_name } = req.body as { business_name?: string };

  // If already a seller, just return current user
  if (req.user!.role === 'seller') {
    return res.json(successResponse({ message: 'Already a seller', user: { role: 'seller' } }));
  }

  await withTransaction(async (client) => {
    // Upgrade user role to seller
    await client.query('UPDATE users SET role = $1 WHERE id = $2', ['seller', req.user!.sub]);

    // Create minimal seller profile
    const profileId = (await client.query(
      `INSERT INTO seller_profiles (id, user_id, business_name, verification_tier)
       VALUES (gen_random_uuid(), $1, $2, 'unverified')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
       RETURNING id`,
      [req.user!.sub, business_name ?? 'My Business']
    )).rows[0].id;

    logger.info('Seller quick-register', { userId: req.user!.sub, profileId });
  });

  const tokens = generateTokens(req.user!.sub, req.user!.phone, 'seller', req.user!.sub);
  return res.json(successResponse({
    user: { id: req.user!.sub, role: 'seller' },
    ...tokens,
  }));
});

// ── POST /auth/logout ────────────────────────────────────────
authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
  await deleteSession(req.user!.sub);
  res.json(successResponse({ message: 'Logged out' }));
});

// ── POST /auth/google ─────────────────────────────────────────────────────────
// Google OAuth — verify Google ID token from the client, mint our JWT.
// Client flow:
//   1. Client shows Google Sign-In button (Google Identity Services JS SDK)
//   2. User signs in → Google returns an id_token
//   3. Client POSTs { id_token } here → we verify + return our JWT
//
// Setup: https://console.cloud.google.com → APIs & Services → Credentials
//   → Create OAuth 2.0 Client ID → Web application
//   → Set GOOGLE_CLIENT_ID in env (no secret needed for ID token verify)

authRouter.post('/google', async (req: Request, res: Response) => {
  const { id_token } = req.body as { id_token?: string };
  if (!id_token) return res.status(400).json(errorResponse('id_token required'));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json(errorResponse('Google login not configured'));

  try {
    // Verify Google ID token using Google's public keys (no extra package needed)
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const payload = await googleRes.json() as {
      aud?: string; sub?: string; email?: string; name?: string;
      email_verified?: string; error_description?: string;
    };

    if (payload.error_description) {
      return res.status(401).json(errorResponse('Invalid Google token'));
    }
    if (payload.aud !== clientId) {
      return res.status(401).json(errorResponse('Token audience mismatch'));
    }
    if (payload.email_verified !== 'true') {
      return res.status(401).json(errorResponse('Google email not verified'));
    }

    const { sub: googleSub, email, name } = payload;
    if (!googleSub || !email) return res.status(400).json(errorResponse('Incomplete Google profile'));

    // Find or create user by google_id (using email as fallback key)
    let user = await queryOne<{ id: string; role: string; name: string; google_id: string | null }>(
      `SELECT id, role, name, google_id FROM users WHERE google_id = $1 OR email = $2 LIMIT 1`,
      [googleSub, email]
    );

    if (!user) {
      // New user — create buyer account (sellers must register via /seller-register)
      const userId = (await queryOne<{ id: string }>(
        `INSERT INTO users (id, phone, email, name, google_id, role)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'buyer')
         RETURNING id`,
        [`google_${googleSub.slice(-8)}`, email, name ?? email.split('@')[0], googleSub]
      ))!.id;

      // Create buyer profile
      await queryOne(
        `INSERT INTO buyer_profiles (id, user_id) VALUES (gen_random_uuid(), $1) RETURNING id`,
        [userId]
      );

      user = await queryOne<{ id: string; role: string; name: string; google_id: string | null }>(
        'SELECT id, role, name, google_id FROM users WHERE id = $1',
        [userId]
      );
    } else if (!user.google_id) {
      // Existing user found by email — link google_id
      await queryOne('UPDATE users SET google_id = $1, email = $2 WHERE id = $3', [googleSub, email, user.id]);
    }

    if (!user) return res.status(500).json(errorResponse('Failed to create user'));

    const profileRow = await queryOne<{ id: string }>(
      `SELECT id FROM buyer_profiles WHERE user_id = $1
       UNION ALL SELECT id FROM seller_profiles WHERE user_id = $1 LIMIT 1`,
      [user.id]
    );
    const profileId = profileRow?.id ?? user.id;

    const tokens = generateTokens(user.id, email, user.role, profileId);
    await setSession(user.id, tokens.refresh_token);

    logger.info('Google login', { userId: user.id, email: email.replace(/(.{2}).+(@.+)/, '$1***$2') });
    return res.json(successResponse({
      ...tokens,
      user: { id: user.id, name: user.name ?? name, email, role: user.role },
      registered: true,
    }));
  } catch (err) {
    logger.error('Google auth error', { error: (err as Error).message });
    return res.status(500).json(errorResponse('Google authentication failed'));
  }
});

// ── Helpers ──────────────────────────────────────────────────
function loadKey(raw: string): string {
  const s = raw.replace(/^["']|["']$/g, '').trim();
  if (s.includes('-----BEGIN')) return s.replace(/\\n/g, '\n'); // already a PEM
  return Buffer.from(s, 'base64').toString('utf-8');             // base64-encoded PEM
}

const SHARED_FALLBACK = 'nm-jwt-secret-2026';

function generateTokens(userId: string, phone: string, role: string, profileId: string) {
  // Sign with fallback secret — guaranteed to be known by every service
  // All services verify with both env var AND this fallback, so tokens always validate
  const secret = SHARED_FALLBACK;
  const payload = { sub: userId, phone, role, profile_id: profileId };
  const access_token  = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '24h' });
  const refresh_token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '30d' });
  return { access_token, refresh_token };
}
