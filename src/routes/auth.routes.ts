import { Router } from 'express';
import {
  findUserByEmail,
  seedDefaultGroups,
  seedDefaultUsers,
  signToken,
  toAuthUser,
  verifyPassword,
} from '../services/auth.service';
import { AuthRequest, authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', (req, res) => {
  seedDefaultUsers();
  seedDefaultGroups();

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = findUserByEmail(email.trim().toLowerCase());
  if (!user || !verifyPassword(user, password)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const authUser = toAuthUser(user);
  const token = signToken(authUser);
  res.json({ token, user: authUser });
});

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

export default router;
