import { Router } from 'express';
import { AuthRequest, authMiddleware, requireAnyPermission } from '../middleware/auth.middleware';
import {
  canViewReports,
  exportReportData,
  exportReportExcel,
  getActivityFeed,
  getAwardAnalytics,
  getCertificateAnalytics,
  getDashboardOverview,
  getEventAnalytics,
  getStudentAnalytics,
  getVoiceAnalytics,
} from '../services/report.service';
import { ReportExportEntity, ReportFilters } from '../types';

const router = Router();

const viewReport = requireAnyPermission(
  { module: 'report', action: 'view' },
  { module: 'report', action: 'view_self' }
);

router.use(authMiddleware);

router.get('/overview', viewReport, (req: AuthRequest, res) => {
  if (!req.user || !canViewReports(req.user)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }
  res.json(getDashboardOverview(req.user, parseFilters(req)));
});

router.get('/students', viewReport, (req: AuthRequest, res) => {
  res.json(getStudentAnalytics(req.user!, parseFilters(req)));
});

router.get('/voice', viewReport, (req: AuthRequest, res) => {
  res.json(getVoiceAnalytics(req.user!, parseFilters(req)));
});

router.get('/certificates', viewReport, (req: AuthRequest, res) => {
  res.json(getCertificateAnalytics(req.user!, parseFilters(req)));
});

router.get('/awards', viewReport, (req: AuthRequest, res) => {
  res.json(getAwardAnalytics(req.user!, parseFilters(req)));
});

router.get('/events', viewReport, (req: AuthRequest, res) => {
  res.json(getEventAnalytics(req.user!, parseFilters(req)));
});

router.get('/activity', viewReport, (req: AuthRequest, res) => {
  const limit = req.query['limit'] ? Number(req.query['limit']) : 20;
  res.json(getActivityFeed(req.user!, limit));
});

router.get('/export/:entity', viewReport, (req: AuthRequest, res) => {
  const entity = String(req.params.entity) as ReportExportEntity;
  const format = String(req.query['format'] ?? 'csv');
  const filters = parseFilters(req);
  const valid: ReportExportEntity[] = ['students', 'voice', 'certificates', 'awards', 'events', 'audit'];

  if (!valid.includes(entity)) {
    res.status(400).json({ error: 'Invalid export entity' });
    return;
  }

  const exported =
    format === 'excel'
      ? exportReportExcel(req.user!, entity, filters)
      : exportReportData(req.user!, entity, filters);

  res.setHeader('Content-Type', exported.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
  res.send(exported.content);
});

function parseFilters(req: AuthRequest): ReportFilters {
  const q = req.query;
  return {
    fromDate: q['fromDate'] ? String(q['fromDate']) : undefined,
    toDate: q['toDate'] ? String(q['toDate']) : undefined,
    groupId: q['groupId'] ? Number(q['groupId']) : undefined,
    studentId: q['studentId'] ? Number(q['studentId']) : undefined,
  };
}

export default router;
