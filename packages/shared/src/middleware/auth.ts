import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole, errorResponse } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const FALLBACK_SECRET = 'nm-jwt-secret-2026';

function getSecrets(): string[] {
  const env = (process.env.INTERNAL_SERVICE_SECRET || '').replace(/['"]/g, '').trim();
  // Try env var first, then fallback — handles Railway secret mismatch across services
  const secrets = env ? [env, FALLBACK_SECRET] : [FALLBACK_SECRET];
  return [...new Set(secrets)]; // deduplicate if env === fallback
}

function verifyToken(token: string): JwtPayload {
  const secrets = getSecrets();
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
    } catch {
      // try next secret
    }
  }
  throw new Error('TOKEN_INVALID');
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('Authentication required', 'AUTH_REQUIRED'));
    return;
  }
  const token = header.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json(errorResponse('Invalid or expired token', 'TOKEN_INVALID'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('Authentication required', 'AUTH_REQUIRED'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json(errorResponse('Insufficient permissions', 'FORBIDDEN'));
      return;
    }
    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      // ignore — optional auth
    }
  }
  next();
}
