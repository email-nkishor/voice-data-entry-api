import { Router } from 'express';
import { AuthRequest, authMiddleware, requirePermission } from '../middleware/auth.middleware';
import {
  addEventParticipants,
  createEvent,
  deleteEvent,
  getEventById,
  listEventParticipants,
  listEvents,
  updateEvent,
} from '../services/event.service';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('event', 'view'), (req: AuthRequest, res) => {
  const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
  const status = req.query.status as string | undefined;
  res.json(listEvents(req.user!, { groupId, status }));
});

router.get('/:id', requirePermission('event', 'view'), (req: AuthRequest, res) => {
  const event = getEventById(Number(req.params.id), req.user!);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json(event);
});

router.post('/', requirePermission('event', 'create'), (req: AuthRequest, res) => {
  const { title, startDate } = req.body as { title?: string; startDate?: string };
  if (!title?.trim() || !startDate) {
    res.status(400).json({ error: 'title and startDate are required' });
    return;
  }
  const created = createEvent(req.body, req.user!.id);
  res.status(201).json(created);
});

router.put('/:id', requirePermission('event', 'create'), (req: AuthRequest, res) => {
  const updated = updateEvent(Number(req.params.id), req.body);
  if (!updated) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json(updated);
});

router.delete('/:id', requirePermission('event', 'create'), (req, res) => {
  const ok = deleteEvent(Number(req.params.id));
  if (!ok) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json({ success: true });
});

router.get('/:id/participants', requirePermission('event', 'view'), (req, res) => {
  res.json(listEventParticipants(Number(req.params.id)));
});

router.post('/:id/participants', requirePermission('event', 'create'), (req, res) => {
  const { studentIds } = req.body as { studentIds?: number[] };
  if (!studentIds?.length) {
    res.status(400).json({ error: 'studentIds array is required' });
    return;
  }
  const participants = addEventParticipants(Number(req.params.id), studentIds);
  res.status(201).json(participants);
});

export default router;
