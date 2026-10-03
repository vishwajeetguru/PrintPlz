import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, generateReadablePassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { makeShopCode } from '../lib/shop';
import { normalizePhone } from '../lib/otp';
import { auth, type AuthedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { Events, emitToAll, emitToShop } from '../realtime/io';

const router = Router();
router.use(auth);

/**
 * Vendors: only own shop. Superadmins: all shops (?all=true or no scope).
 */
router.get('/', async (req: AuthedRequest, res) => {
  if (req.role === 'SUPER_ADMIN') {
    const { search, active } = req.query as { search?: string; active?: string };
    const shops = await prisma.shop.findMany({
      where: {
        ...(search
          ? { OR: [{ name: { contains: search } }, { shopCode: { contains: search } }, { phone: { contains: search } }] }
          : {}),
        ...(active === 'true' ? { isActive: true } : active === 'false' ? { isActive: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { requests: true, printers: true } } },
    });
    return res.json({ shops });
  }
  const shop = await prisma.shop.findFirst({ where: { ownerUserId: req.userId } });
  return res.json({ shops: shop ? [shop] : [] });
});

router.get('/:id', async (req: AuthedRequest, res) => {
  const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (req.role === 'VENDOR' && shop.ownerUserId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const [requests, printers] = await Promise.all([
    prisma.printRequest.count({ where: { shopId: shop.id } }),
    prisma.printer.count({ where: { shopId: shop.id } }),
  ]);
  return res.json({ shop, stats: { requests, printers } });
});

// Superadmin: create shop + generate password
const createSchema = z.object({
  name: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  phone: z.string().min(6).max(20),
  address: z.string().max(300).optional(),
  password: z.string().min(6).max(72).optional(),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  workingDays: z.string().max(100).optional(),
  priceBw: z.number().int().min(1).max(100).optional(),
  priceColor: z.number().int().min(1).max(500).optional(),
});

router.post('/', requireRole('SUPER_ADMIN'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const phone = normalizePhone(parsed.data.phone);
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return res.status(409).json({ error: 'Phone already registered' });

  const password = parsed.data.password ?? generateReadablePassword(10);
  const count = await prisma.shop.count();
  const shopCode = makeShopCode(parsed.data.ownerName, 1024 + count);

  const user = await prisma.user.create({
    data: { phone, name: parsed.data.ownerName, role: 'VENDOR', passwordHash: await hashPassword(password), mustSetPassword: false },
  });
  const shop = await prisma.shop.create({
    data: {
      shopCode,
      name: parsed.data.name,
      ownerName: parsed.data.ownerName,
      phone,
      address: parsed.data.address,
      openTime: parsed.data.openTime,
      closeTime: parsed.data.closeTime,
      workingDays: parsed.data.workingDays,
      ownerUserId: user.id,
      qrUrl: `https://printplz.app/shop/${shopCode}`,
      priceBw: parsed.data.priceBw ?? 2,
      priceColor: parsed.data.priceColor ?? 10,
    },
  });
  // Notify the new shop
  await prisma.notification.create({
    data: { shopId: shop.id, type: 'INFO', title: 'Welcome to PrintPlz', message: `Your shop ${shop.name} is live.` },
  });
  emitToShop(shop.id, Events.SHOP_UPDATED, { shop });
  // Return generated password ONCE — admin shows/copies it.
  return res.status(201).json({ shop, generatedPassword: parsed.data.password ? undefined : password });
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  ownerName: z.string().max(120).optional(),
  address: z.string().max(300).optional().nullable(),
  phone: z.string().min(6).max(20).optional(),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  workingDays: z.string().max(100).optional().nullable(),
  isOnline: z.boolean().optional(),
  priceBw: z.number().int().min(1).max(100).optional(),
  priceColor: z.number().int().min(1).max(500).optional(),
});

router.patch('/:id', async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (req.role === 'VENDOR' && shop.ownerUserId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  if (req.role === 'VENDOR' && ('phone' in parsed.data)) delete (parsed.data as Record<string, unknown>).phone;
  const updated = await prisma.shop.update({ where: { id: shop.id }, data: parsed.data });
  emitToShop(shop.id, Events.SHOP_UPDATED, { shop: updated });
  return res.json({ shop: updated });
});

router.post('/:id/deactivate', requireRole('SUPER_ADMIN'), async (req, res) => {
  const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const updated = await prisma.shop.update({ where: { id: shop.id }, data: { isActive: false } });
  if (shop.ownerUserId) await prisma.user.update({ where: { id: shop.ownerUserId }, data: { isActive: false } });
  await prisma.notification.create({
    data: { shopId: shop.id, type: 'SHOP_DEACTIVATED', title: 'Shop deactivated', message: 'Your shop has been deactivated. Please contact PrintPlz support.' },
  });
  emitToShop(shop.id, Events.SHOP_STATUS, { shopId: shop.id, isActive: false });
  emitToAll(Events.SHOP_UPDATED, { shop: updated });
  return res.json({ shop: updated });
});

router.post('/:id/activate', requireRole('SUPER_ADMIN'), async (req, res) => {
  const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const updated = await prisma.shop.update({ where: { id: shop.id }, data: { isActive: true } });
  if (shop.ownerUserId) await prisma.user.update({ where: { id: shop.ownerUserId }, data: { isActive: true } });
  await prisma.notification.create({
    data: { shopId: shop.id, type: 'INFO', title: 'Shop reactivated', message: 'Your shop is active again.' },
  });
  emitToShop(shop.id, Events.SHOP_STATUS, { shopId: shop.id, isActive: true });
  return res.json({ shop: updated });
});

// Superadmin: reset/generate password for a shop owner
router.post('/:id/reset-password', requireRole('SUPER_ADMIN'), async (req, res) => {
  const schema = z.object({ password: z.string().min(6).max(72).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!shop?.ownerUserId) return res.status(404).json({ error: 'Shop owner not found' });
  const password = parsed.data.password ?? generateReadablePassword(10);
  await prisma.user.update({
    where: { id: shop.ownerUserId },
    data: { passwordHash: await hashPassword(password), mustSetPassword: false },
  });
  await prisma.notification.create({
    data: { shopId: shop.id, type: 'INFO', title: 'Password reset', message: 'Your password was reset by support. Use the new password sent to you.' },
  });
  emitToShop(shop.id, Events.NOTIFICATION_NEW, { title: 'Password reset' });
  return res.json({ generatedPassword: parsed.data.password ? undefined : password, success: true });
});

// Superadmin: permanently delete a shop, its owner login, and all shop data
router.delete('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  // Delete the owner login first (cascades refresh tokens).
  // Requests / printers / notifications cascade off the shop delete.
  if (shop.ownerUserId) {
    await prisma.user.deleteMany({ where: { id: shop.ownerUserId } });
  }
  await prisma.shop.delete({ where: { id: shop.id } });
  emitToShop(shop.id, Events.SHOP_STATUS, { shopId: shop.id, isActive: false, deleted: true });
  emitToAll(Events.SHOP_UPDATED, { shopId: shop.id, deleted: true });
  return res.json({ success: true, shopCode: shop.shopCode });
});

export default router;
