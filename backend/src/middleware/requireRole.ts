import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from './auth';

/** Allow only the given roles. */
export function requireRole(...roles: Array<'SUPER_ADMIN' | 'VENDOR'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    return next();
  };
}
