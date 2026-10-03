import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { env } from '../config/env';
import { priceFor } from '../lib/shop';
import { prisma } from '../lib/prisma';
import { Events, emitToShop } from '../realtime/io';

const router = Router();

const dir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(dir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: env.MAX_FILE_MB * 1024 * 1024 },
});

let seq = 2000;

// GET /api/public/shops/:code — customer landing via QR (no auth)
router.get('/shops/:code', async (req, res) => {
  const shop = await prisma.shop.findUnique({ where: { shopCode: req.params.code } });
  if (!shop || !shop.isActive) return res.status(404).json({ error: 'Shop not found or inactive' });
  const maintenance = await prisma.systemSetting.findUnique({ where: { key: 'maintenance_mode' } });
  if (maintenance?.value === 'true') return res.status(503).json({ error: 'MAINTENANCE', message: 'PrintPlz is under maintenance.' });
  return res.json({
    shop: { shopCode: shop.shopCode, name: shop.name, phone: shop.phone, isOnline: shop.isOnline, priceBw: shop.priceBw, priceColor: shop.priceColor },
  });
});

// POST /api/public/shops/:code/requests — customer upload (multipart or JSON)
const bodySchema = z.object({
  documentName: z.string().min(1).max(200).optional(),
  pages: z.coerce.number().int().min(1).max(1000).default(2),
  copies: z.coerce.number().int().min(1).max(100).default(1),
  colorMode: z.enum(['BW', 'COLOR']).default('BW'),
  paperSize: z.enum(['A4', 'A3', 'LETTER', 'LEGAL']).default('A4'),
  printSides: z.enum(['SINGLE', 'DOUBLE']).default('SINGLE'),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(20).optional(),
});

router.post('/shops/:code/requests', upload.single('file'), async (req, res) => {
  const shop = await prisma.shop.findUnique({ where: { shopCode: req.params.code } });
  if (!shop || !shop.isActive) return res.status(404).json({ error: 'Shop not found or inactive' });
  if (!shop.isOnline) return res.status(503).json({ error: 'Shop offline' });
  const maintenance = await prisma.systemSetting.findUnique({ where: { key: 'maintenance_mode' } });
  if (maintenance?.value === 'true') return res.status(503).json({ error: 'MAINTENANCE' });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const ext = (req.file?.originalname.split('.').pop() ?? 'PDF').toUpperCase();
  const fileType = ext === 'JPG' || ext === 'JPEG' ? 'JPG' : ext === 'PNG' ? 'PNG' : ext === 'DOCX' ? 'DOCX' : 'PDF';

  const totalPages = parsed.data.printSides === 'DOUBLE'
    ? Math.ceil((parsed.data.pages * parsed.data.copies) / 2)
    : parsed.data.pages * parsed.data.copies;
  const amount = priceFor(parsed.data.pages, parsed.data.copies, parsed.data.colorMode, shop.priceBw, shop.priceColor);

  seq += 1;
  const created = await prisma.printRequest.create({
    data: {
      id: `PF${seq}`,
      shopId: shop.id,
      documentName: req.file?.originalname ?? parsed.data.documentName ?? 'Document.pdf',
      fileType: fileType as never,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      fileSizeBytes: req.file?.size ?? 0,
      pages: parsed.data.pages,
      copies: parsed.data.copies,
      colorMode: parsed.data.colorMode,
      paperSize: parsed.data.paperSize,
      printSides: parsed.data.printSides,
      totalPages,
      amount,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
    },
  });
  await prisma.notification.create({
    data: { shopId: shop.id, type: 'NEW_REQUEST', title: 'New Print Request', message: `New request ${created.id} from customer.`, requestId: created.id },
  });
  emitToShop(shop.id, Events.REQUEST_CREATED, { request: created });
  return res.status(201).json({ request: created, estimatedWaitMinutes: 5 });
});

// GET /api/public/requests/:id — customer tracking (no auth, id-guessable but short-lived is fine for v1)
router.get('/requests/:id', async (req, res) => {
  const r = await prisma.printRequest.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ error: 'Not found' });
  return res.json({ request: { id: r.id, status: r.status, amount: r.amount, totalPages: r.totalPages, updatedAt: r.updatedAt } });
});

export default router;
