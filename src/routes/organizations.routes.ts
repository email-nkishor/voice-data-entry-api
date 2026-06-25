import { Router } from 'express';
import { getRepository } from '../db/database';
import { AuthRequest, authMiddleware, requirePermission } from '../middleware/auth.middleware';
import { getCurrentOrganization, organizationToApi, updateOrganizationSettings } from '../services/organization.service';

const router = Router();

router.use(authMiddleware);

router.get('/current', (_req, res) => {
  res.json(organizationToApi(getCurrentOrganization()));
});

router.put('/current', requirePermission('organization', 'manage'), (req: AuthRequest, res) => {
  const { settings, name } = req.body as { settings?: Record<string, unknown>; name?: string };
  const org = getCurrentOrganization();
  if (name?.trim()) {
    const repo = getRepository();
    repo.updateOrganization({
      ...org,
      name: name.trim(),
      updated_at: new Date().toISOString(),
    });
  }
  if (settings) {
    updateOrganizationSettings(settings);
  }
  res.json(organizationToApi(getCurrentOrganization()));
});

export default router;
