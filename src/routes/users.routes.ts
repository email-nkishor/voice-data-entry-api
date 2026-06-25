import { Router } from 'express';
import { AuthRequest, authMiddleware, requirePermission } from '../middleware/auth.middleware';
import {
  createUserAccount,
  deleteUserAccount,
  getUserById,
  linkParentToStudent,
  listUsers,
  updateUserAccount,
  userToApi,
} from '../services/user.service';
import { CreateUserInput, UpdateUserInput } from '../types';

const router = Router();

router.use(authMiddleware);
router.use(requirePermission('user', 'manage'));

router.get('/', (_req, res) => {
  res.json(listUsers());
});

router.get('/:id', (req, res) => {
  const user = getUserById(Number(req.params.id));
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(userToApi(user));
});

router.post('/', (req: AuthRequest, res) => {
  const input = req.body as CreateUserInput;
  if (!input.email || !input.password || !input.name || !input.role) {
    res.status(400).json({ error: 'email, password, name, and role are required' });
    return;
  }
  try {
    const user = createUserAccount(input);
    res.status(201).json(userToApi(user));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create user' });
  }
});

router.put('/:id', (req, res) => {
  const input = req.body as UpdateUserInput;
  const updated = updateUserAccount(Number(req.params.id), input);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(userToApi(updated));
});

router.delete('/:id', (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (req.user?.id === id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }
  const ok = deleteUserAccount(id);
  if (!ok) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ success: true });
});

router.post('/:id/link-student', (req, res) => {
  const { studentId, relationship } = req.body as { studentId?: number; relationship?: string };
  if (!studentId) {
    res.status(400).json({ error: 'studentId is required' });
    return;
  }
  const link = linkParentToStudent(Number(req.params.id), studentId, relationship ?? 'guardian');
  res.status(201).json({
    id: link.id,
    userId: link.user_id,
    studentId: link.student_id,
    relationship: link.relationship,
  });
});

export default router;
