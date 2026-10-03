import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, type AuthedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { Events, emitToAll, emitToShop, getIO } from '../realtime/io';

const router = Router();
router.use(auth);

// Vendor: own notifications (own shop + broadcasts). Superadmin: all.
router.get('/', async (req: AuthedRequest, res) => {
  if (req.role === 'SUPER_ADMIN') {
    const shopId = req.query.shopId as string | undefined;
    const list = await prisma.notification.findMany({
      where: shopId ? { OR: [{ shopId }, { broadcast: true }] } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json({ notifications: list.map(toMobile) });
  }
  const list = await prisma.notification.findMany({
    where: { OR: [{ shopId: req.shopId! }, { broadcast: true }] },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return res.json({ notifications: list.map(toMobile) });
});

router.post('/read-all', async (req: AuthedRequest, res) => {
  if (req.role === 'SUPER_ADMIN') {
    await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
  } else {
    await prisma.notification.updateMany({
      where: { OR: [{ shopId: req.shopId! }, { broadcast: true }], read: false },
      data: { read: true },
    });
  }
  return res.json({ success: true });
});

// Superadmin: send notice to one shop or all (broadcast)
const noticeSchema = z.object({
  shopId: z.string().optional(),
  broadcast: z.boolean().default(false),
  title: z.string().min(2).max(140),
  message: z.string().min(2).max(1000),
});

router.post('/notices', requireRole('SUPER_ADMIN'), async (req, res) => {
  const parsed = noticeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  if (!parsed.data.broadcast && !parsed.data.shopId) return res.status(400).json({ error: 'shopId or broadcast required' });

  if (parsed.data.broadcast) {
    const created = await prisma.notification.create({
      data: { broadcast: true, type: 'NOTICE', title: parsed.data.title, message: parsed.data.message },
    });
    emitToAll(Events.NOTIFICATION_NEW, { notification: toMobile(created) });
    void getIO()?.to('superadmin').emit(Events.NOTIFICATION_NEW, { notification: toMobile(created) });
    return res.status(201).json({ notification: toMobile(created) });
  }

  const created = await prisma.notification.create({
    data: { shopId: parsed.data.shopId!, type: 'NOTICE', title: parsed.data.title, message: parsed.data.message },
  });
  emitToShop(parsed.data.shopId!, Events.NOTIFICATION_NEW, { notification: toMobile(created) });
  return res.status(201).json({ notification: toMobile(created) });
});

function toMobile(n: {
  id: string; type: string; title: string; message: string; createdAt: Date; read: boolean; requestId: string | null;
}) {
  const mins = Math.max(0, Math.round((Date.now() - +n.createdAt) / 60000));
  const timeAgo = mins < 1 ? 'now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
  return {
    id: n.id,
    type: n.type === 'NOTICE' ? 'INFO' : n.type,
    title: n.title,
    message: n.message,
    timeAgo,
    createdAt: n.createdAt.toISOString(),
    read: n.read,
    requestId: n.requestId,
  };
}

export default router;
