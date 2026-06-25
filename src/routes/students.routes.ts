import { Router } from 'express';
import { AuthRequest, authMiddleware, requireRoles } from '../middleware/auth.middleware';
import {
  approveAdmission,
  apiToStudentInput,
  createStudent,
  deleteStudent,
  getDashboardStats,
  getStudentById,
  listActivities,
  listStudents,
  studentToApi,
  updateStudent,
} from '../services/student.service';

const router = Router();

router.use(authMiddleware);

router.get('/stats', (req, res) => {
  const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
  const stats = getDashboardStats(groupId);
  res.json(stats);
});

router.get('/activities', (req, res) => {
  const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  res.json(listActivities(studentId, limit));
});

router.get('/', (req, res) => {
  const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
  const students = listStudents(groupId).map((s) => studentToApi(s));
  res.json(students);
});

router.get('/:id', (req, res) => {
  const student = getStudentById(Number(req.params.id));
  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }
  res.json(studentToApi(student, true));
});

router.post('/', requireRoles('admin', 'admission_clerk'), (req: AuthRequest, res) => {
  const input = apiToStudentInput(req.body);
  if (!input.name?.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const created = createStudent(input, req.user?.id);
  res.status(201).json(studentToApi(created));
});

router.put('/:id', requireRoles('admin', 'admission_clerk'), (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const input = apiToStudentInput(req.body);
  const updated = updateStudent(id, input, req.user?.id);
  if (!updated) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }
  res.json(studentToApi(updated));
});

router.delete('/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const ok = deleteStudent(Number(req.params.id), req.user?.id);
  if (!ok) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }
  res.json({ success: true });
});

router.post('/:id/approve', requireRoles('admin', 'admission_clerk'), (req: AuthRequest, res) => {
  const updated = approveAdmission(Number(req.params.id), req.user?.id);
  if (!updated) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }
  res.json(studentToApi(updated));
});

export default router;
