import express from 'express';
import cors from 'cors';
import { config, isCorsOriginAllowed } from './config';
import { seedDefaultGroups, seedDefaultUsers, seedDemoStudentAndLinks } from './services/auth.service';
import { seedDefaultLookups } from './services/lookups.service';
import { seedDefaultCustomFields } from './services/custom-field.service';
import { seedDefaultTemplates } from './services/certificate-template.service';
import { seedRichDemoData } from './services/seed-demo-data.service';
import { syncParentEntitiesFromUserLinks } from './services/parent-entity.service';
import authRoutes from './routes/auth.routes';
import organizationsRoutes from './routes/organizations.routes';
import usersRoutes from './routes/users.routes';
import studentsRoutes from './routes/students.routes';
import studentGroupsRoutes from './routes/student-groups.routes';
import eventsRoutes from './routes/events.routes';
import attendanceRoutes from './routes/attendance.routes';
import customFieldsRoutes from './routes/custom-fields.routes';
import certificateTemplatesRoutes from './routes/certificate-templates.routes';
import certificatesRoutes from './routes/certificates.routes';
import awardsRoutes from './routes/awards.routes';
import voiceEntriesRoutes from './routes/voice-entries.routes';
import reportsRoutes from './routes/reports.routes';
import parentRoutes from './routes/parent.routes';
import syncRoutes from './routes/sync.routes';
import speechRoutes from './routes/speech.routes';
import lookupsRoutes from './routes/lookups.routes';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (isCorsOriginAllowed(origin)) {
          callback(null, origin ?? true);
        } else {
          console.warn(`CORS blocked origin: ${origin}`);
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
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
  app.use('/api/organizations', organizationsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/students', studentsRoutes);
  app.use('/api/student-groups', studentGroupsRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/custom-fields', customFieldsRoutes);
  app.use('/api/certificate-templates', certificateTemplatesRoutes);
  app.use('/api/certificates', certificatesRoutes);
  app.use('/api/awards', awardsRoutes);
  app.use('/api/voice-entries', voiceEntriesRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/parent', parentRoutes);
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
  seedDefaultCustomFields();
  seedDefaultTemplates();
  seedDemoStudentAndLinks();
  seedRichDemoData();
  syncParentEntitiesFromUserLinks();
}
