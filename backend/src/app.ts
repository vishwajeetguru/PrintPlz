import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import analyticsRoutes from './routes/analytics.routes';
import authRoutes from './routes/auth.routes';
import notificationsRoutes from './routes/notifications.routes';
import printersRoutes from './routes/printers.routes';
import publicRoutes from './routes/public.routes';
import requestsRoutes from './routes/requests.routes';
import shopsRoutes from './routes/shops.routes';
import systemRoutes from './routes/system.routes';
import uploadsRoutes from './routes/uploads.routes';

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: [env.CLIENT_URL], credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'printplz-backend' }));
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

  app.use('/api/auth', authRoutes);
  app.use('/api/shops', shopsRoutes);
  app.use('/api/requests', requestsRoutes);
  app.use('/api/printers', printersRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/public', publicRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}
