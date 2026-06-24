import { Router } from 'express';
import { authMiddleware, requireRoles } from '../middleware/auth.middleware';
import { createGroup, deleteGroup, listGroups } from '../services/student.service';

const router = Router();

router.use(authMiddleware);

router.get('/', (_req, res) => {
  const groups = listGroups().map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    isDefault: !!g.is_default,
    clientId: g.client_id,
    createdDate: g.created_at,
  }));
  res.json(groups);
});

router.post('/', requireRoles('admin', 'admission_clerk'), (req, res) => {
  const { name, description, clientId } = req.body as {
    name?: string;
    description?: string;
    clientId?: number;
  };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }
  const created = createGroup(name.trim(), description?.trim(), clientId);
  res.status(201).json({
    id: created.id,
    name: created.name,
    description: created.description,
    isDefault: !!created.is_default,
    clientId: created.client_id,
    createdDate: created.created_at,
  });
});

router.delete('/:id', requireRoles('admin'), (req, res) => {
  const ok = deleteGroup(Number(req.params.id));
  if (!ok) {
    res.status(400).json({ error: 'Group not found or is default' });
    return;
  }
  res.json({ success: true });
});

export default router;
