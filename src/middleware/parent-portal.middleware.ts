import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { isParentAttendanceEnabled, isParentPortalEnabled } from '../services/organization.service';

export function requireParentPortalEnabled(req: AuthRequest, res: Response, next: NextFunction): void {
  const orgId = req.user?.organizationId ?? 1;
  if (!isParentPortalEnabled(orgId)) {
    res.status(403).json({
      error: 'Parent portal is not enabled for this organization',
      code: 'PARENT_PORTAL_DISABLED',
    });
    return;
  }
  next();
}

export function requireParentAttendanceEnabled(req: AuthRequest, res: Response, next: NextFunction): void {
  const orgId = req.user?.organizationId ?? 1;
  if (!isParentAttendanceEnabled(orgId)) {
    res.status(403).json({
      error: 'Parent attendance views are not enabled for this organization',
      code: 'PARENT_ATTENDANCE_DISABLED',
    });
    return;
  }
  next();
}
