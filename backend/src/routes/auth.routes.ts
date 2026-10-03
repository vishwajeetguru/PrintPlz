import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { hashPassword, verifyPassword } from '../lib/password';
import { signAccess, signRefresh, verifyRefresh } from '../lib/jwt';
import { makeOtp, normalizePhone, otpExpiry } from '../lib/otp';
import { prisma } from '../lib/prisma';
import { makeShopCode } from '../lib/shop';
import { auth, type AuthedRequest } from '../middleware/auth';

const router = Router();

const sendOtpSchema = z.object({
  phone: z.string().min(6).max(20),
  shopName: z.string().max(120).optional(),
  ownerName: z.string().max(120).optional(),
});

async function issueTokens(userId: string, role: 'SUPER_ADMIN' | 'VENDOR', shopId: string | null) {
  const accessToken = signAccess({ sub: userId, role, shopId });
  const refreshToken = signRefresh({ sub: userId });
  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken };
}

async function mePayload(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const shop = user.role === 'VENDOR' ? await prisma.shop.findFirst({ where: { ownerUserId: user.id } }) : null;
  const maintenance = await prisma.systemSetting.findUnique({ where: { key: 'maintenance_mode' } });
  return {
    user: { id: user.id, phone: user.phone, name: user.name, role: user.role, mustSetPassword: user.mustSetPassword, isActive: user.isActive },
    shop: shop
      ? {
          id: shop.id,
          shopCode: shop.shopCode,
          shopName: shop.name,
          ownerName: shop.ownerName,
          phone: shop.phone,
          address: shop.address,
          openTime: shop.openTime,
          closeTime: shop.closeTime,
          workingDays: shop.workingDays,
          isActive: shop.isActive,
          isOnline: shop.isOnline,
          qrUrl: shop.qrUrl ?? `https://printplz.app/shop/${shop.shopCode}`,
          priceBw: shop.priceBw,
          priceColor: shop.priceColor,
        }
      : null,
    maintenanceMode: maintenance?.value === 'true',
  };
}

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid phone' });
  const phone = normalizePhone(parsed.data.phone);
  const code = makeOtp();

  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone, role: 'VENDOR', name: parsed.data.ownerName, otpCode: code, otpExpiresAt: otpExpiry() },
    });
  } else {
    if (!user.isActive) return res.status(403).json({ error: 'Account disabled. Contact support.' });
    await prisma.user.update({ where: { id: user.id }, data: { otpCode: code, otpExpiresAt: otpExpiry() } });
  }
  // TODO: plug SMS provider here. In dev we return the code.
  return res.json({ success: true, devCode: env.NODE_ENV === 'production' ? undefined : code });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const schema = z.object({
    phone: z.string(),
    code: z.string().length(6),
    shopName: z.string().max(120).optional(),
    ownerName: z.string().max(120).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const phone = normalizePhone(parsed.data.phone);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.otpCode || !user.otpExpiresAt) return res.status(400).json({ error: 'Request a new OTP first' });
  if (user.otpExpiresAt < new Date()) return res.status(400).json({ error: 'OTP expired' });
  if (parsed.data.code !== user.otpCode) return res.status(400).json({ error: 'Invalid OTP' });

  await prisma.user.update({ where: { id: user.id }, data: { otpCode: null, otpExpiresAt: null } });

  let shopId: string | null = null;
  if (user.role === 'VENDOR') {
    let shop = await prisma.shop.findFirst({ where: { ownerUserId: user.id } });
    if (!shop) {
      const count = await prisma.shop.count();
      const code = makeShopCode(parsed.data.ownerName ?? user.name ?? 'Shop', 1024 + count);
      shop = await prisma.shop.create({
        data: {
          shopCode: code,
          name: parsed.data.shopName ?? 'New Print Shop',
          ownerName: parsed.data.ownerName ?? user.name ?? 'Owner',
          phone,
          ownerUserId: user.id,
          qrUrl: `https://printplz.app/shop/${code}`,
        },
      });
    }
    shopId = shop.id;
  }

  const tokens = await issueTokens(user.id, user.role, shopId);
  const me = await mePayload(user.id);
  return res.json({ ...tokens, mustSetPassword: !user.passwordHash, ...me });
});

// POST /api/auth/set-password (first set + change when authed)
router.post('/set-password', auth, async (req: AuthedRequest, res) => {
  const schema = z.object({ newPassword: z.string().min(6).max(72) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Password must be 6+ characters' });
  await prisma.user.update({
    where: { id: req.userId! },
    data: { passwordHash: await hashPassword(parsed.data.newPassword), mustSetPassword: false },
  });
  return res.json({ success: true });
});

// POST /api/auth/login-password
router.post('/login-password', async (req, res) => {
  const schema = z.object({ phone: z.string(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const phone = normalizePhone(parsed.data.phone);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.isActive) return res.status(403).json({ error: 'Account disabled. Contact support.' });
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  let shopId: string | null = null;
  if (user.role === 'VENDOR') {
    const shop = await prisma.shop.findFirst({ where: { ownerUserId: user.id } });
    shopId = shop?.id ?? null;
    if (shop && !shop.isActive) {
      return res.status(403).json({ error: 'SHOP_DEACTIVATED', message: 'Your shop has been deactivated. Please contact PrintPlz support.' });
    }
  }
  const tokens = await issueTokens(user.id, user.role, shopId);
  const me = await mePayload(user.id);
  return res.json({ ...tokens, ...me });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });
  try {
    const payload = verifyRefresh(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) return res.status(401).json({ error: 'Refresh expired' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Account disabled' });
    let shopId: string | null = null;
    if (user.role === 'VENDOR') {
      const shop = await prisma.shop.findFirst({ where: { ownerUserId: user.id } });
      shopId = shop?.id ?? null;
    }
    const accessToken = signAccess({ sub: user.id, role: user.role, shopId });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req: AuthedRequest, res) => {
  const me = await mePayload(req.userId!);
  if (!me) return res.status(404).json({ error: 'Not found' });
  return res.json(me);
});

// POST /api/auth/logout
router.post('/logout', auth, async (req: AuthedRequest, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  return res.json({ success: true });
});

// PATCH /api/auth/online
router.patch('/online', auth, async (req: AuthedRequest, res) => {
  if (req.role !== 'VENDOR' || !req.shopId) return res.status(403).json({ error: 'Vendors only' });
  const { isOnline } = req.body as { isOnline?: boolean };
  const shop = await prisma.shop.update({ where: { id: req.shopId }, data: { isOnline: !!isOnline } });
  return res.json({ isOnline: shop.isOnline });
});

export default router;
