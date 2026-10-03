import type { NextFunction, Request, Response } from 'express';
import { verifyAccess } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export interface AuthedRequest extends Request {
  userId?: string;
  role?: 'SUPER_ADMIN' | 'VENDOR';
  shopId?: string | null;
}

export async function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = verifyAccess(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Account disabled' });
    req.userId = user.id;
    req.role = user.role;
    // Re-resolve shop for vendors (owner relation may change)
    if (user.role === 'VENDOR') {
      const shop = await prisma.shop.findFirst({ where: { ownerUserId: user.id } });
      req.shopId = shop?.id ?? null;
    } else {
      req.shopId = null;
    }
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
