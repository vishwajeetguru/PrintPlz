import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { priceFor } from '../lib/shop';
import { prisma } from '../lib/prisma';
import { auth, type AuthedRequest } from '../middleware/auth';
import { requireActiveShop } from '../middleware/shopScope';
import { Events, emitToShop } from '../realtime/io';

const router = Router();
router.use(auth);

function scopeWhere(req: AuthedRequest, extra: Record<string, unknown> = {}) {
  if (req.role === 'SUPER_ADMIN') {
    const shopId = req.query.shopId as string | undefined;
    return { ...(shopId ? { shopId } : {}), ...extra };
  }
  return { shopId: req.shopId!, ...extra };
}

let requestSeq = 1025;
function nextRequestId(): string {
  requestSeq += 1;
  return `PF${requestSeq}`;
}

// GET /api/requests?status&search
router.get('/', requireActiveShop, async (req: AuthedRequest, res) => {
  const { status, search } = req.query as { status?: string; search?: string };
  const where = scopeWhere(req, {
    ...(status && status !== 'ALL' ? { status: status as never } : {}),
    ...(search
      ? { OR: [{ id: { contains: search } }, { documentName: { contains: search } }, { customerName: { contains: search } }] }
      : {}),
  });
  const requests = await prisma.printRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  return res.json({ requests: requests.map(toMobile) });
});

router.get('/:id', requireActiveShop, async (req: AuthedRequest, res) => {
  const r = await prisma.printRequest.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (req.role === 'VENDOR' && r.shopId !== req.shopId) return res.status(403).json({ error: 'Forbidden' });
  return res.json({ request: toMobile(r) });
});

const statusSchema = z.object({ status: z.enum(['NEW', 'ACCEPTED', 'PRINTING', 'COMPLETED', 'CANCELLED']) });

router.patch('/:id/status', requireActiveShop, async (req: AuthedRequest, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });
  const r = await prisma.printRequest.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (req.role === 'VENDOR' && r.shopId !== req.shopId) return res.status(403).json({ error: 'Forbidden' });

  const updated = await prisma.printRequest.update({ where: { id: r.id }, data: { status: parsed.data.status } });

  if (parsed.data.status === 'COMPLETED') {
    await prisma.notification.create({
      data: { shopId: r.shopId, type: 'PRINT_COMPLETED', title: 'Print Completed', message: `Request #${r.id} has been printed.`, requestId: r.id },
    });
  }
  const payload = toMobile(updated);
  emitToShop(r.shopId, Events.REQUEST_UPDATED, { request: payload });
  return res.json({ request: payload });
});

// Vendor creates a manual request (walk-in customer)
const createSchema = z.object({
  documentName: z.string().min(1).max(200),
  fileType: z.enum(['PDF', 'JPG', 'PNG', 'DOCX']).default('PDF'),
  pages: z.number().int().min(1).max(1000).default(1),
  copies: z.number().int().min(1).max(100).default(1),
  colorMode: z.enum(['BW', 'COLOR']).default('BW'),
  paperSize: z.enum(['A4', 'A3', 'LETTER', 'LEGAL']).default('A4'),
  printSides: z.enum(['SINGLE', 'DOUBLE']).default('SINGLE'),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(20).optional(),
  fileUrl: z.string().max(500).optional(),
  fileSizeBytes: z.number().int().min(0).default(0),
});

router.post('/', requireActiveShop, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const shopId = req.role === 'SUPER_ADMIN' ? ((req.body.shopId as string) || '') : req.shopId!;
  if (!shopId) return res.status(400).json({ error: 'shopId required' });
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const totalPages = parsed.data.printSides === 'DOUBLE' ? Math.ceil((parsed.data.pages * parsed.data.copies) / 2) : parsed.data.pages * parsed.data.copies;
  const amount = priceFor(parsed.data.pages, parsed.data.copies, parsed.data.colorMode, shop.priceBw, shop.priceColor);

  const created = await prisma.printRequest.create({
    data: { id: nextRequestId(), shopId, ...parsed.data, totalPages, amount },
  });
  await prisma.notification.create({
    data: { shopId, type: 'NEW_REQUEST', title: 'New Print Request', message: 'New print request from a customer.', requestId: created.id },
  });
  const payload = toMobile(created);
  emitToShop(shopId, Events.REQUEST_CREATED, { request: payload });
  emitToShop(shopId, Events.NOTIFICATION_NEW, { title: 'New Print Request', requestId: created.id });
  return res.status(201).json({ request: payload });
});

function toMobile(r: {
  id: string; documentName: string; fileType: string; pages: number; copies: number; colorMode: string;
  paperSize: string; printSides: string; totalPages: number; amount: number; status: string;
  createdAt: Date; fileSizeBytes: number; customerName: string | null; customerPhone: string | null;
}) {
  const mb = r.fileSizeBytes / (1024 * 1024);
  return {
    id: r.id,
    documentName: r.documentName,
    fileType: r.fileType,
    pages: r.pages,
    copies: r.copies,
    colorMode: r.colorMode,
    paperSize: r.paperSize,
    printSides: r.printSides,
    totalPages: r.totalPages,
    amount: r.amount,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    uploadedAtLabel: `Uploaded ${r.createdAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`,
    fileSize: mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(r.fileSizeBytes / 1024))} KB`,
    fileSizeBytes: r.fileSizeBytes,
    customerName: r.customerName ?? 'Walk-in',
    customerPhone: r.customerPhone ?? '',
  };
}

export function toMobileRequest(r: Parameters<typeof toMobile>[0]) {
  return toMobile(r);
}

export default router;
export { env as _env };
