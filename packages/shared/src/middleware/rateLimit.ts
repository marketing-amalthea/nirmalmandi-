import { Request, Response, NextFunction } from 'express';
import { getRedis, incrementRateLimit } from '../db/redis';
import { errorResponse } from '../types';

export function rateLimiter(maxRequests: number, windowSeconds = 60) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.user?.sub ?? req.ip ?? 'anonymous';
    const key = `${req.path}:${identifier}`;
    try {
      const count = await incrementRateLimit(key, windowSeconds);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
      if (count > maxRequests) {
        res.status(429).json(errorResponse('Too many requests. Please slow down.', 'RATE_LIMITED'));
        return;
      }
    } catch {
      // Redis unavailable — fail open, log warning
      console.warn('Rate limiter Redis unavailable — allowing request');
    }
    next();
  };
}

// OTP-specific: max 3 sends per phone per 30 minutes
export function otpRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const phone = req.body?.phone as string;
    if (!phone) { next(); return; }
    try {
      const key = `otp_send:${phone}`;
      const redis = getRedis();
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 1800); // 30 min window
      if (count > 3) {
        res.status(429).json(errorResponse('OTP limit reached. Try again in 30 minutes.', 'OTP_LIMIT'));
        return;
      }
    } catch {
      console.warn('OTP rate limiter unavailable');
    }
    next();
  };
}
