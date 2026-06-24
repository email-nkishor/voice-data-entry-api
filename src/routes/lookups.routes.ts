import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getAllLookups, getLookupCategory } from '../services/lookups.service';

const router = Router();

router.use(authMiddleware);

router.get('/', (_req, res) => {
  res.json(getAllLookups());
});

router.get('/:category', (req, res) => {
  const options = getLookupCategory(req.params.category);
  if (!options) {
    res.status(404).json({ error: 'Unknown lookup category' });
    return;
  }
  res.json(options);
});

export default router;
