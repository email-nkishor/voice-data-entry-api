import { Router } from 'express';
import { AuthRequest, authMiddleware, requireRoles } from '../middleware/auth.middleware';
import { requireParentAttendanceEnabled, requireParentPortalEnabled } from '../middleware/parent-portal.middleware';
import { logAudit } from '../services/audit.service';
import {
  getChildAttendance,
  getChildAttendanceSummary,
  getChildAwards,
  getChildCertificates,
  getChildDetail,
  getChildEvents,
  getChildVoiceHistory,
  getNotificationPreferences,
  getParentDashboard,
  getParentProfile,
  listParentChildren,
  logCertificateDownload,
  logCertificateVerification,
  updateNotificationPreferences,
} from '../services/parent.service';

const router = Router();

router.use(authMiddleware);
router.use(requireParentPortalEnabled);
router.use(requireRoles('parent'));

router.get('/profile', (req: AuthRequest, res) => {
  try {
    res.json(getParentProfile(req.user!));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/dashboard', (req: AuthRequest, res) => {
  const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
  try {
    res.json(getParentDashboard(req.user!, studentId));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/children', (req: AuthRequest, res) => {
  try {
    res.json(listParentChildren(req.user!));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/children/:studentId', (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  try {
    res.json(getChildDetail(req.user!, studentId));
  } catch (err) {
    res.status(403).json({ error: (err as Error).message });
  }
});

router.get('/children/:studentId/voice-entries', (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  try {
    res.json(getChildVoiceHistory(req.user!, studentId));
  } catch (err) {
    res.status(403).json({ error: (err as Error).message });
  }
});

router.get('/children/:studentId/certificates', (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  try {
    res.json(getChildCertificates(req.user!, studentId));
  } catch (err) {
    res.status(403).json({ error: (err as Error).message });
  }
});

router.post('/children/:studentId/certificates/:certificateId/download', (req: AuthRequest, res) => {
  const certificateId = Number(req.params.certificateId);
  logCertificateDownload(req.user!, certificateId);
  res.json({ ok: true });
});

router.post('/children/:studentId/certificates/:certificateId/verify', (req: AuthRequest, res) => {
  const certificateId = Number(req.params.certificateId);
  logCertificateVerification(req.user!, certificateId);
  res.json({ ok: true });
});

router.get('/children/:studentId/awards', (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  try {
    res.json(getChildAwards(req.user!, studentId));
  } catch (err) {
    res.status(403).json({ error: (err as Error).message });
  }
});

router.get('/children/:studentId/events', (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  try {
    res.json(getChildEvents(req.user!, studentId));
  } catch (err) {
    res.status(403).json({ error: (err as Error).message });
  }
});

router.get('/children/:studentId/attendance', requireParentAttendanceEnabled, (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
  const toDate = req.query.toDate ? String(req.query.toDate) : undefined;
  const contextType = req.query.contextType ? String(req.query.contextType) : undefined;
  try {
    res.json(getChildAttendance(req.user!, studentId, { fromDate, toDate, contextType }));
  } catch (err) {
    res.status(403).json({ error: (err as Error).message });
  }
});

router.get('/children/:studentId/attendance/summary', requireParentAttendanceEnabled, (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
  const toDate = req.query.toDate ? String(req.query.toDate) : undefined;
  try {
    res.json(getChildAttendanceSummary(req.user!, studentId, { fromDate, toDate }));
  } catch (err) {
    res.status(403).json({ error: (err as Error).message });
  }
});

router.get('/notification-preferences', (req: AuthRequest, res) => {
  try {
    res.json(getNotificationPreferences(req.user!));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.put('/notification-preferences', (req: AuthRequest, res) => {
  try {
    res.json(updateNotificationPreferences(req.user!, req.body));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
