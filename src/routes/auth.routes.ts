import { Router } from 'express';
import {
  ensureDefaultUsers,
  findUserByEmail,
  seedDefaultGroups,
  seedDefaultUsers,
  seedDemoStudentAndLinks,
  signToken,
  toAuthUser,
  verifyPassword,
} from '../services/auth.service';
import { seedRichDemoData } from '../services/seed-demo-data.service';
import { AuthRequest, authMiddleware } from '../middleware/auth.middleware';
import { logAudit } from '../services/audit.service';
import { isParentPortalEnabled, isParentAttendanceEnabled } from '../services/organization.service';

const router = Router();

router.post('/login', (req, res) => {
  seedDefaultUsers();
  ensureDefaultUsers();
  seedDefaultGroups();
  seedDemoStudentAndLinks();
  seedRichDemoData();

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = findUserByEmail(email.trim().toLowerCase());
  if (!user || user.status !== 'active' || !verifyPassword(user, password)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const authUser = toAuthUser(user);
  const token = signToken(authUser);

  if (authUser.role === 'parent' && isParentPortalEnabled(authUser.organizationId)) {
    logAudit('parent', authUser.id, 'parent_login', { email: authUser.email }, authUser.id, authUser.organizationId);
  }

  res.json({
    token,
    user: authUser,
    parentPortalEnabled: isParentPortalEnabled(authUser.organizationId),
    parentAttendanceEnabled: isParentAttendanceEnabled(authUser.organizationId),
  });
});

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const user = findUserByEmail(req.user.email);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: toAuthUser(user) });
});

export default router;
