import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthUser, UserRole } from '../types';
import { userHasPermission } from '../services/permission.service';

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & {
      sub?: number;
      id?: number;
      email: string;
      name: string;
      role: UserRole;
      organizationId?: number;
      permissions?: AuthUser['permissions'];
      linkedStudentIds?: number[];
    };
    req.user = {
      id: Number(decoded.sub ?? decoded.id),
      email: String(decoded.email),
      name: String(decoded.name),
      role: decoded.role,
      organizationId: decoded.organizationId ?? 1,
      permissions: decoded.permissions ?? [],
      linkedStudentIds: decoded.linkedStudentIds ?? [],
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRoles(...roles: UserRole[]) {
  const expanded = new Set<UserRole>(roles);
  if (roles.includes('clerk')) {
    expanded.add('admission_clerk');
  }
  if (roles.includes('admission_clerk')) {
    expanded.add('clerk');
  }

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!expanded.has(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function requirePermission(module: string, action: string) {
  return requireAnyPermission({ module, action });
}

export function requireAnyPermission(...checks: { module: string; action: string }[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const allowed = checks.some((check) => userHasPermission(req.user!, check.module, check.action));
    if (!allowed) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
