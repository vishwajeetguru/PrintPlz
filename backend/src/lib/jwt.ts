import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessPayload {
  sub: string;
  role: 'SUPER_ADMIN' | 'VENDOR';
  shopId: string | null;
}

export function signAccess(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL } as jwt.SignOptions);
}

export function signRefresh(payload: { sub: string }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL } as jwt.SignOptions);
}

export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

export function verifyRefresh(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
}
