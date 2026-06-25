import { Router } from 'express';
import { AuthRequest, authMiddleware, requireAnyPermission, requirePermission } from '../middleware/auth.middleware';
import { listAuditLogs } from '../services/audit.service';
import {
  apiToAwardInput,
  approveAward,
  createAward,
  getAwardById,
  getAwardStats,
  getStudentAchievementSummary,
  listAwards,
  listAwardsForStudent,
  revokeAward,
  updateAward,
} from '../services/award.service';
import { AwardCategory, AwardFilters, AwardStatus } from '../types';

const router = Router();

router.use(authMiddleware);

const viewAward = requireAnyPermission(
  { module: 'award', action: 'view' },
  { module: 'award', action: 'view_self' },
  { module: 'award', action: 'view_child' }
);

router.get('/', viewAward, (req: AuthRequest, res) => {
  res.json(listAwards(req.user!, parseFilters(req)));
});

router.get('/stats', viewAward, (req: AuthRequest, res) => {
  res.json(getAwardStats(req.user!));
});

router.get('/student/:studentId', viewAward, (req: AuthRequest, res) => {
  const limit = req.query['limit'] ? Number(req.query['limit']) : 20;
  res.json(listAwardsForStudent(req.user!, Number(req.params.studentId), limit));
});

router.get('/student/:studentId/summary', viewAward, (req: AuthRequest, res) => {
  const summary = getStudentAchievementSummary(req.user!, Number(req.params.studentId));
  if (!summary) {
    res.status(404).json({ error: 'Student not found or not accessible' });
    return;
  }
  res.json(summary);
});

router.get('/:id', viewAward, (req: AuthRequest, res) => {
  const award = getAwardById(req.user!, Number(req.params.id));
  if (!award) {
    res.status(404).json({ error: 'Award not found' });
    return;
  }
  res.json(award);
});

router.get('/:id/audit', requirePermission('award', 'view'), (req: AuthRequest, res) => {
  const award = getAwardById(req.user!, Number(req.params.id));
  if (!award) {
    res.status(404).json({ error: 'Award not found' });
    return;
  }
  res.json(listAuditLogs('award', award.id));
});

router.post('/', requireAnyPermission(
  { module: 'award', action: 'create' },
  { module: 'award', action: 'recommend' }
), (req: AuthRequest, res) => {
  const input = apiToAwardInput(req.body as Record<string, unknown>);
  if (!input.studentId || !input.category || !input.title?.trim()) {
    res.status(400).json({ error: 'studentId, category, and title are required' });
    return;
  }
  try {
    res.status(201).json(createAward(input, req.user!));
  } catch (err) {
    res.status(403).json({ error: err instanceof Error ? err.message : 'Failed to create award' });
  }
});

router.put('/:id', requirePermission('award', 'create'), (req: AuthRequest, res) => {
  const updated = updateAward(Number(req.params.id), apiToAwardInput(req.body as Record<string, unknown>), req.user!);
  if (!updated) {
    res.status(404).json({ error: 'Award not found' });
    return;
  }
  res.json(updated);
});

router.post('/:id/approve', requirePermission('award', 'create'), (req: AuthRequest, res) => {
  const approved = approveAward(Number(req.params.id), req.user!);
  if (!approved) {
    res.status(404).json({ error: 'Award not found' });
    return;
  }
  res.json(approved);
});

router.post('/:id/revoke', requirePermission('award', 'create'), (req: AuthRequest, res) => {
  const revoked = revokeAward(Number(req.params.id), req.user!);
  if (!revoked) {
    res.status(404).json({ error: 'Award not found' });
    return;
  }
  res.json(revoked);
});

function parseFilters(req: AuthRequest): AwardFilters {
  const q = req.query;
  return {
    studentId: q['studentId'] ? Number(q['studentId']) : undefined,
    category: q['category'] ? (String(q['category']) as AwardCategory) : undefined,
    status: q['status'] ? (String(q['status']) as AwardStatus) : undefined,
    fromDate: q['fromDate'] ? String(q['fromDate']) : undefined,
    toDate: q['toDate'] ? String(q['toDate']) : undefined,
    search: q['search'] ? String(q['search']) : undefined,
    limit: q['limit'] ? Number(q['limit']) : 50,
    offset: q['offset'] ? Number(q['offset']) : 0,
  };
}

export default router;
