import { Router } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.middleware';
import { processSyncPush, pullChanges } from '../services/sync.service';
import { SyncPushItem } from '../types';

const router = Router();

router.use(authMiddleware);

router.post('/push', (req: AuthRequest, res) => {
  const { items } = req.body as { items?: SyncPushItem[] };
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }
  const results = processSyncPush(items, req.user?.id);
  const synced = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  res.json({ results, synced, failed, syncedAt: new Date().toISOString() });
});

router.get('/pull', (req, res) => {
  const since = req.query.since as string | undefined;
  res.json(pullChanges(since));
});

export default router;
