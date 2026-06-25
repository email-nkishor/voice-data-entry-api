import { Router } from 'express';
import { AuthRequest, authMiddleware, requirePermission, requireRoles } from '../middleware/auth.middleware';
import {
  assignStudentsToGroup,
  createGroup,
  deleteGroup,
  listGroups,
  updateGroup,
} from '../services/student.service';

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

router.post('/', requirePermission('group', 'create'), (req, res) => {
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

router.put('/:id', requirePermission('group', 'modify'), (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }
  const updated = updateGroup(Number(req.params.id), name.trim(), description?.trim());
  if (!updated) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  res.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    isDefault: !!updated.is_default,
    clientId: updated.client_id,
    createdDate: updated.created_at,
  });
});

router.post('/:id/assign-students', requirePermission('group', 'assign'), (req: AuthRequest, res) => {
  const { studentIds } = req.body as { studentIds?: number[] };
  if (!studentIds?.length) {
    res.status(400).json({ error: 'studentIds array is required' });
    return;
  }
  const count = assignStudentsToGroup(Number(req.params.id), studentIds, req.user?.id);
  res.json({ success: true, assignedCount: count });
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
