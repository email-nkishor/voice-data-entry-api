import express from 'express';
import cors from 'cors';
import { config } from './config';
import { seedDefaultGroups, seedDefaultUsers } from './services/auth.service';
import { seedDefaultLookups } from './services/lookups.service';
import authRoutes from './routes/auth.routes';
import studentsRoutes from './routes/students.routes';
import studentGroupsRoutes from './routes/student-groups.routes';
import syncRoutes from './routes/sync.routes';
import speechRoutes from './routes/speech.routes';
import lookupsRoutes from './routes/lookups.routes';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      dbDriver: config.dbDriver,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentsRoutes);
  app.use('/api/student-groups', studentGroupsRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/speech', speechRoutes);
  app.use('/api/lookups', lookupsRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

export function bootstrap() {
  seedDefaultUsers();
  seedDefaultGroups();
  seedDefaultLookups();
}
