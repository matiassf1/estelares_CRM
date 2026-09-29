import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AssocOperatorPayload {
  id: string;
  type: 'assoc_operator';
  associationId: string;
  role: 'ADMIN' | 'OPERATOR';
}

declare global {
  namespace Express {
    interface Request {
      assocUser?: AssocOperatorPayload;
    }
  }
}

export function assocAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AssocOperatorPayload;
    if (payload.type !== 'assoc_operator') {
      res.status(403).json({ error: 'Token inválido para este recurso' });
      return;
    }
    req.assocUser = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

export function requireAssocRole(...roles: ('ADMIN' | 'OPERATOR')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.assocUser || !roles.includes(req.assocUser.role)) {
      res.status(403).json({ error: 'Sin permisos' });
      return;
    }
    next();
  };
}

export function signAssocToken(payload: AssocOperatorPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
