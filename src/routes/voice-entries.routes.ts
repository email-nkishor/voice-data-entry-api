import { Router } from 'express';
import { AuthRequest, authMiddleware, requirePermission } from '../middleware/auth.middleware';
import { listAuditLogs } from '../services/audit.service';
import {
  apiToVoiceEntryInput,
  createVoiceEntry,
  getVoiceEntryById,
  getVoiceEntryEdits,
  getVoiceEntryStats,
  listVoiceEntries,
  listVoiceEntriesForStudent,
  updateVoiceEntry,
} from '../services/voice-entry.service';
import { VoiceEntryFilters, VoiceEntryStatus } from '../types';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('voice', 'view'), (req: AuthRequest, res) => {
  const filters = parseFilters(req);
  res.json(listVoiceEntries(req.user!, filters));
});

router.get('/stats', requirePermission('voice', 'view'), (req: AuthRequest, res) => {
  res.json(getVoiceEntryStats(req.user!));
});

router.get('/student/:studentId', requirePermission('voice', 'view'), (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  const limit = req.query['limit'] ? Number(req.query['limit']) : 20;
  res.json(listVoiceEntriesForStudent(req.user!, studentId, limit));
});

router.get('/:id', requirePermission('voice', 'view'), (req: AuthRequest, res) => {
  const entry = getVoiceEntryById(req.user!, Number(req.params.id));
  if (!entry) {
    res.status(404).json({ error: 'Voice entry not found' });
    return;
  }
  res.json(entry);
});

router.get('/:id/edits', requirePermission('voice', 'view'), (req: AuthRequest, res) => {
  const edits = getVoiceEntryEdits(req.user!, Number(req.params.id));
  if (edits === undefined) {
    res.status(404).json({ error: 'Voice entry not found' });
    return;
  }
  res.json(edits);
});

router.get('/:id/audit', requirePermission('voice', 'view'), (req: AuthRequest, res) => {
  const entry = getVoiceEntryById(req.user!, Number(req.params.id));
  if (!entry) {
    res.status(404).json({ error: 'Voice entry not found' });
    return;
  }
  res.json(listAuditLogs('voice_entry', entry.id));
});

router.post('/', requirePermission('voice', 'create'), (req: AuthRequest, res) => {
  const input = apiToVoiceEntryInput(req.body as Record<string, unknown>);
  if (!input.transcript?.trim()) {
    res.status(400).json({ error: 'transcript is required' });
    return;
  }
  if (!input.moduleCode) {
    res.status(400).json({ error: 'moduleCode is required' });
    return;
  }
  try {
    const created = createVoiceEntry(input, req.user!);
    res.status(201).json(created);
  } catch (err) {
    res.status(403).json({ error: err instanceof Error ? err.message : 'Failed to create voice entry' });
  }
});

router.put('/:id', requirePermission('voice', 'create'), (req: AuthRequest, res) => {
  try {
    const updated = updateVoiceEntry(
      Number(req.params.id),
      apiToVoiceEntryInput(req.body as Record<string, unknown>),
      req.user!
    );
    if (!updated) {
      res.status(404).json({ error: 'Voice entry not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update voice entry';
    const status = message.includes('Not authorized') ? 403 : 400;
    res.status(status).json({ error: message });
  }
});

function parseFilters(req: AuthRequest): VoiceEntryFilters {
  const q = req.query;
  return {
    studentId: q['studentId'] ? Number(q['studentId']) : undefined,
    moduleCode: q['moduleCode'] ? String(q['moduleCode']) : undefined,
    status: q['status'] ? (String(q['status']) as VoiceEntryStatus) : undefined,
    speechEngine: q['speechEngine'] ? String(q['speechEngine']) : undefined,
    createdBy: q['createdBy'] ? Number(q['createdBy']) : undefined,
    fromDate: q['fromDate'] ? String(q['fromDate']) : undefined,
    toDate: q['toDate'] ? String(q['toDate']) : undefined,
    search: q['search'] ? String(q['search']) : undefined,
    limit: q['limit'] ? Number(q['limit']) : 50,
    offset: q['offset'] ? Number(q['offset']) : 0,
  };
}

export default router;
