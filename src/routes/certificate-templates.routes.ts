import { Router } from 'express';
import { AuthRequest, authMiddleware, requirePermission } from '../middleware/auth.middleware';
import {
  apiToTemplateInput,
  createTemplate,
  getTemplateById,
  listTemplates,
  updateTemplate,
} from '../services/certificate-template.service';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('certificate', 'view'), (req: AuthRequest, res) => {
  const includeInactive = req.query['includeInactive'] === 'true';
  res.json(listTemplates(req.user!, includeInactive));
});

router.get('/:id', requirePermission('certificate', 'view'), (req: AuthRequest, res) => {
  const template = getTemplateById(Number(req.params.id));
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(template);
});

router.post('/', requirePermission('certificate', 'manage_templates'), (req: AuthRequest, res) => {
  const input = apiToTemplateInput(req.body as Record<string, unknown>);
  if (!input.name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(createTemplate(input, req.user!));
});

router.put('/:id', requirePermission('certificate', 'manage_templates'), (req: AuthRequest, res) => {
  const updated = updateTemplate(Number(req.params.id), apiToTemplateInput(req.body as Record<string, unknown>), req.user!);
  if (!updated) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(updated);
});

export default router;
