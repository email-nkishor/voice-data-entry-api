import { Router } from 'express';
import { AuthRequest, authMiddleware, requireAnyPermission, requirePermission } from '../middleware/auth.middleware';
import { listAuditLogs } from '../services/audit.service';
import {
  apiToCertificateInput,
  createCertificate,
  getCertificateById,
  getCertificateStats,
  listCertificates,
  listCertificatesForStudent,
  revokeCertificate,
  updateCertificate,
  verifyCertificate,
} from '../services/certificate.service';
import { CertificateFilters, CertificateStatus, CertificateType } from '../types';

const router = Router();

router.get('/verify/:code', (req, res) => {
  res.json(verifyCertificate(String(req.params.code)));
});

router.use(authMiddleware);

router.get('/', requireAnyPermission(
  { module: 'certificate', action: 'view' },
  { module: 'certificate', action: 'view_self' },
  { module: 'certificate', action: 'view_child' }
), (req: AuthRequest, res) => {
  res.json(listCertificates(req.user!, parseFilters(req)));
});

router.get('/stats', requireAnyPermission(
  { module: 'certificate', action: 'view' },
  { module: 'certificate', action: 'view_self' },
  { module: 'certificate', action: 'view_child' }
), (req: AuthRequest, res) => {
  res.json(getCertificateStats(req.user!));
});

router.get('/student/:studentId', requireAnyPermission(
  { module: 'certificate', action: 'view' },
  { module: 'certificate', action: 'view_self' },
  { module: 'certificate', action: 'view_child' }
), (req: AuthRequest, res) => {
  const limit = req.query['limit'] ? Number(req.query['limit']) : 20;
  res.json(listCertificatesForStudent(req.user!, Number(req.params.studentId), limit));
});

router.get('/:id', requireAnyPermission(
  { module: 'certificate', action: 'view' },
  { module: 'certificate', action: 'view_self' },
  { module: 'certificate', action: 'view_child' }
), (req: AuthRequest, res) => {
  const cert = getCertificateById(req.user!, Number(req.params.id));
  if (!cert) {
    res.status(404).json({ error: 'Certificate not found' });
    return;
  }
  res.json(cert);
});

router.get('/:id/audit', requirePermission('certificate', 'view'), (req: AuthRequest, res) => {
  const cert = getCertificateById(req.user!, Number(req.params.id));
  if (!cert) {
    res.status(404).json({ error: 'Certificate not found' });
    return;
  }
  res.json(listAuditLogs('certificate', cert.id));
});

router.post('/', requirePermission('certificate', 'create'), (req: AuthRequest, res) => {
  const input = apiToCertificateInput(req.body as Record<string, unknown>);
  if (!input.studentId || !input.title?.trim() || !input.issuedBy?.trim()) {
    res.status(400).json({ error: 'studentId, title, and issuedBy are required' });
    return;
  }
  try {
    res.status(201).json(createCertificate(input, req.user!));
  } catch (err) {
    res.status(403).json({ error: err instanceof Error ? err.message : 'Failed to create certificate' });
  }
});

router.put('/:id', requirePermission('certificate', 'edit'), (req: AuthRequest, res) => {
  try {
    const updated = updateCertificate(Number(req.params.id), apiToCertificateInput(req.body as Record<string, unknown>), req.user!);
    if (!updated) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update certificate' });
  }
});

router.post('/:id/revoke', requirePermission('certificate', 'revoke'), (req: AuthRequest, res) => {
  const reason = String((req.body as { reason?: string }).reason ?? '');
  const revoked = revokeCertificate(Number(req.params.id), reason, req.user!);
  if (!revoked) {
    res.status(404).json({ error: 'Certificate not found' });
    return;
  }
  res.json(revoked);
});

function parseFilters(req: AuthRequest): CertificateFilters {
  const q = req.query;
  return {
    studentId: q['studentId'] ? Number(q['studentId']) : undefined,
    certificateType: q['certificateType'] ? (String(q['certificateType']) as CertificateType) : undefined,
    status: q['status'] ? (String(q['status']) as CertificateStatus) : undefined,
    templateId: q['templateId'] ? Number(q['templateId']) : undefined,
    fromDate: q['fromDate'] ? String(q['fromDate']) : undefined,
    toDate: q['toDate'] ? String(q['toDate']) : undefined,
    search: q['search'] ? String(q['search']) : undefined,
    limit: q['limit'] ? Number(q['limit']) : 50,
    offset: q['offset'] ? Number(q['offset']) : 0,
  };
}

export default router;
