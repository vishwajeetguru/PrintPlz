import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, type AuthedRequest } from '../middleware/auth';
import { requireActiveShop } from '../middleware/shopScope';
import { Events, emitToShop } from '../realtime/io';

const router = Router();
router.use(auth, requireActiveShop);

const connMap: Record<string, 'WIFI' | 'BLUETOOTH' | 'USB' | 'NETWORK'> = {
  'WI-FI': 'WIFI',
  WIFI: 'WIFI',
  BLUETOOTH: 'BLUETOOTH',
  USB: 'USB',
  NETWORK: 'NETWORK',
};

function toMobile(p: {
  id: string; name: string; connectionType: string; status: string; isDefault: boolean;
  paperLevel: number; tonerLevel: string; tonerPercent: number; ipAddress: string | null; model: string | null;
}) {
  return {
    id: p.id,
    name: p.name,
    connectionType: p.connectionType === 'WIFI' ? 'WI-FI' : p.connectionType,
    status: p.status,
    isDefault: p.isDefault,
    paperLevel: p.paperLevel,
    tonerLevel: p.tonerLevel,
    tonerPercent: p.tonerPercent,
    ipAddress: p.ipAddress,
    model: p.model,
  };
}

router.get('/', async (req: AuthedRequest, res) => {
  const shopId = req.role === 'SUPER_ADMIN' ? ((req.query.shopId as string) ?? req.shopId!) : req.shopId!;
  if (!shopId) return res.status(400).json({ error: 'shopId required' });
  const printers = await prisma.printer.findMany({ where: { shopId }, orderBy: { createdAt: 'asc' } });
  return res.json({ printers: printers.map(toMobile) });
});

const upsertSchema = z.object({
  name: z.string().min(2).max(120),
  connectionType: z.enum(['WI-FI', 'WIFI', 'BLUETOOTH', 'USB', 'NETWORK']).default('WI-FI'),
  status: z.enum(['CONNECTED', 'OFFLINE', 'PRINTING', 'READY', 'ERROR']).default('OFFLINE'),
  isDefault: z.boolean().optional(),
  paperLevel: z.number().int().min(0).max(100).default(100),
  tonerLevel: z.string().max(20).default('Good'),
  tonerPercent: z.number().int().min(0).max(100).default(100),
  ipAddress: z.string().max(64).optional(),
  model: z.string().max(120).optional(),
});

router.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const shopId = req.role === 'SUPER_ADMIN' ? ((req.body.shopId as string) ?? '') : req.shopId!;
  if (!shopId) return res.status(400).json({ error: 'shopId required' });
  if (parsed.data.isDefault) await prisma.printer.updateMany({ where: { shopId }, data: { isDefault: false } });
  const created = await prisma.printer.create({
    data: { shopId, ...parsed.data, connectionType: connMap[parsed.data.connectionType] },
  });
  emitToShop(shopId, Events.PRINTER_UPDATED, { printer: toMobile(created) });
  return res.status(201).json({ printer: toMobile(created) });
});

router.patch('/:id', async (req: AuthedRequest, res) => {
  const p = await prisma.printer.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.role === 'VENDOR' && p.shopId !== req.shopId) return res.status(403).json({ error: 'Forbidden' });
  const parsed = upsertSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { connectionType, ...rest } = parsed.data;
  if (rest.isDefault) await prisma.printer.updateMany({ where: { shopId: p.shopId }, data: { isDefault: false } });
  const updated = await prisma.printer.update({
    where: { id: p.id },
    data: { ...rest, ...(connectionType ? { connectionType: connMap[connectionType] } : {}) },
  });
  emitToShop(p.shopId, Events.PRINTER_UPDATED, { printer: toMobile(updated) });
  return res.json({ printer: toMobile(updated) });
});

router.post('/:id/default', async (req: AuthedRequest, res) => {
  const p = await prisma.printer.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.role === 'VENDOR' && p.shopId !== req.shopId) return res.status(403).json({ error: 'Forbidden' });
  await prisma.printer.updateMany({ where: { shopId: p.shopId }, data: { isDefault: false } });
  const updated = await prisma.printer.update({ where: { id: p.id }, data: { isDefault: true } });
  emitToShop(p.shopId, Events.PRINTER_UPDATED, { printer: toMobile(updated) });
  return res.json({ printer: toMobile(updated) });
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const p = await prisma.printer.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.role === 'VENDOR' && p.shopId !== req.shopId) return res.status(403).json({ error: 'Forbidden' });
  await prisma.printer.delete({ where: { id: p.id } });
  emitToShop(p.shopId, Events.PRINTER_UPDATED, { deletedId: p.id });
  return res.json({ success: true });
});

export default router;
