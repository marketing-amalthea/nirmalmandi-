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

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) throw new Error('JWT_PUBLIC_KEY not configured');
  return Buffer.from(key, 'base64').toString('utf-8');
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('Authentication required', 'AUTH_REQUIRED'));
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] }) as JwtPayload;
    req.user = payload;
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
      const token = header.slice(7);
      req.user = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] }) as JwtPayload;
    } catch {
      // ignore — optional auth
    }
  }
  next();
}
