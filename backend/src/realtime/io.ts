import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyAccess } from '../lib/jwt';

export const Events = {
  REQUEST_CREATED: 'request:created',
  REQUEST_UPDATED: 'request:updated',
  NOTIFICATION_NEW: 'notification:new',
  SHOP_UPDATED: 'shop:updated',
  SHOP_STATUS: 'shop:status',
  PRINTER_UPDATED: 'printer:updated',
  SYSTEM_MAINTENANCE: 'system:maintenance',
  ANALYTICS_UPDATED: 'analytics:updated',
} as const;

let io: Server | null = null;

export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: [env.CLIENT_URL], credentials: true },
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) ?? undefined;
    if (!token) return next(); // allow public (maintenance polling) but no rooms
    try {
      const payload = verifyAccess(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.data.shopId = payload.shopId;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const role = socket.data.role as string | undefined;
    const shopId = socket.data.shopId as string | undefined;
    if (role === 'SUPER_ADMIN') {
      void socket.join('superadmin');
    }
    if (shopId) {
      void socket.join(`shop:${shopId}`);
    }
    socket.emit('connected', { ok: true });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitToShop(shopId: string, event: string, payload: unknown) {
  io?.to(`shop:${shopId}`).emit(event, payload);
  io?.to('superadmin').emit(event, payload);
}

export function emitToAll(event: string, payload: unknown) {
  io?.emit(event, payload);
}
