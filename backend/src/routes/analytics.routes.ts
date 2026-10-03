import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { auth, type AuthedRequest } from '../middleware/auth';
import { requireActiveShop } from '../middleware/shopScope';

const router = Router();
router.use(auth);

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// GET /api/analytics/summary?shopId&days=30
router.get('/summary', async (req: AuthedRequest, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days ?? 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const shopFilter =
    req.role === 'SUPER_ADMIN' ? ((req.query.shopId as string | undefined) || undefined) : req.shopId!;

  if (req.role === 'VENDOR') {
    const shop = await prisma.shop.findUnique({ where: { id: req.shopId! } });
    if (!shop || !shop.isActive) return res.status(403).json({ error: 'SHOP_DEACTIVATED', message: 'Shop deactivated.' });
  }

  const where = {
    ...(shopFilter ? { shopId: shopFilter } : {}),
    createdAt: { gte: since },
  };

  const totalRequests = await prisma.printRequest.count({ where });
  const completed = await prisma.printRequest.findMany({ where: { ...where, status: 'COMPLETED' } });
  const printers = req.role === 'SUPER_ADMIN' && !shopFilter
    ? 0
    : await prisma.printer.count({ where: shopFilter ? { shopId: shopFilter } : {} });
  const shops = req.role === 'SUPER_ADMIN' && !shopFilter ? await prisma.shop.count() : 1;

  const revenue = completed.reduce((s: number, r: { amount: number }) => s + r.amount, 0);
  const pagesPrinted = completed.reduce((s: number, r: { totalPages: number }) => s + r.totalPages, 0);
  const bw = completed.filter((r: { colorMode: string }) => r.colorMode === 'BW').length;
  const color = completed.filter((r: { colorMode: string }) => r.colorMode === 'COLOR').length;
  const total = Math.max(1, bw + color);

  // Daily series
  const byDay = new Map<string, number>();
  for (const r of await prisma.printRequest.findMany({ where, select: { createdAt: true } })) {
    const k = dayKey(r.createdAt);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const series: Array<{ label: string; value: number; date: string }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const k = dayKey(d);
    series.push({ date: k, label: d.toLocaleDateString('en-IN', { weekday: 'short' }), value: byDay.get(k) ?? 0 });
  }

  return res.json({
    revenue,
    totalRequests,
    completedRequests: completed.length,
    pagesPrinted,
    averageOrder: completed.length ? Math.round(revenue / completed.length) : 0,
    printers,
    shops,
    printType: { bwPercent: Math.round((bw / total) * 100), colorPercent: Math.round((color / total) * 100) },
    requestsOverTime: days <= 14 ? series.slice(-7) : aggregateWeekly(series),
  });
});

function aggregateWeekly(series: Array<{ label: string; value: number; date: string }>) {
  // keep last 7 buckets for mobile chart simplicity
  return series.slice(-7);
}

export default router;
export { requireActiveShop as _guard };
