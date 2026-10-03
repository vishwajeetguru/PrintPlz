import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { Events, emitToAll } from '../realtime/io';

const router = Router();

// Public — mobile checks this on launch (no token needed)
router.get('/status', async (_req, res) => {
  const [mode, message] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'maintenance_mode' } }),
    prisma.systemSetting.findUnique({ where: { key: 'maintenance_message' } }),
  ]);
  return res.json({
    maintenanceMode: mode?.value === 'true',
    message: message?.value ?? 'PrintPlz is under maintenance. Please try again shortly.',
  });
});

// Superadmin toggle
router.put('/maintenance', auth, requireRole('SUPER_ADMIN'), async (req, res) => {
  const schema = z.object({ enabled: z.boolean(), message: z.string().max(500).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  await prisma.systemSetting.upsert({
    where: { key: 'maintenance_mode' },
    update: { value: String(parsed.data.enabled) },
    create: { key: 'maintenance_mode', value: String(parsed.data.enabled) },
  });
  if (parsed.data.message !== undefined) {
    await prisma.systemSetting.upsert({
      where: { key: 'maintenance_message' },
      update: { value: parsed.data.message },
      create: { key: 'maintenance_message', value: parsed.data.message },
    });
  }
  emitToAll(Events.SYSTEM_MAINTENANCE, { maintenanceMode: parsed.data.enabled, message: parsed.data.message });
  return res.json({ maintenanceMode: parsed.data.enabled });
});

export default router;
