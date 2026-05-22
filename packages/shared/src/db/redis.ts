import Redis from 'ioredis';

let redis: Redis;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableOfflineQueue: true,
      tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });

    redis.on('error', (err) => {
      console.error('Redis error:', err.message);
    });

    redis.on('connect', () => {
      console.log('Redis connected');
    });

    redis.on('ready', () => {
      console.log('Redis ready');
    });
  }
  return redis;
}

// ---- OTP helpers ----
export async function setOtp(phone: string, otp: string, ttlSeconds = 120): Promise<void> {
  await getRedis().setex(`otp:${phone}`, ttlSeconds, otp);
}

export async function verifyAndDeleteOtp(phone: string, otp: string): Promise<boolean> {
  const stored = await getRedis().get(`otp:${phone}`);
  if (stored !== otp) return false;
  await getRedis().del(`otp:${phone}`);
  return true;
}

// ---- Stock reservation helpers ----
export async function reserveStock(listingId: string, quantity: number, orderId: string, ttlSeconds = 900): Promise<boolean> {
  const key = `stock_reserve:${listingId}`;
  const val = JSON.stringify({ quantity, orderId, reservedAt: Date.now() });
  const result = await getRedis().set(key, val, 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

export async function releaseStockReservation(listingId: string): Promise<void> {
  await getRedis().del(`stock_reserve:${listingId}`);
}

// ---- Session ----
export async function setSession(userId: string, token: string, ttlSeconds = 86400): Promise<void> {
  await getRedis().setex(`session:${userId}`, ttlSeconds, token);
}

export async function deleteSession(userId: string): Promise<void> {
  await getRedis().del(`session:${userId}`);
}

// ---- Rate limit counter ----
export async function incrementRateLimit(key: string, windowSeconds = 60): Promise<number> {
  const count = await getRedis().incr(`rate:${key}`);
  if (count === 1) await getRedis().expire(`rate:${key}`, windowSeconds);
  return count;
}

// ---- View count buffer ----
export async function bufferViewCount(listingId: string): Promise<void> {
  await getRedis().incr(`views:${listingId}`);
}

export async function flushViewCounts(): Promise<Map<string, number>> {
  const keys = await getRedis().keys('views:*');
  const counts = new Map<string, number>();
  if (!keys.length) return counts;
  const pipeline = getRedis().pipeline();
  for (const k of keys) {
    pipeline.getdel(k);
  }
  const results = await pipeline.exec();
  if (!results) return counts;
  keys.forEach((k, i) => {
    const val = results[i][1] as string;
    if (val) counts.set(k.replace('views:', ''), parseInt(val, 10));
  });
  return counts;
}
