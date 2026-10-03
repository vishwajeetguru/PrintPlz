import type { NextFunction, Response } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthedRequest } from './auth';

/**
 * Vendors whose shop is deactivated are blocked from everything except
 * /auth/me and /system/status — mobile shows "contact support" state.
 */
export async function requireActiveShop(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.role === 'SUPER_ADMIN') return next();
  if (!req.shopId) return res.status(403).json({ error: 'SHOP_NO_SHOP', message: 'No shop linked to this account.' });
  const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (!shop.isActive) {
    return res.status(403).json({
      error: 'SHOP_DEACTIVATED',
      message: 'Your shop has been deactivated. Please contact PrintPlz support.',
      shopId: shop.id,
    });
  }
  return next();
}
