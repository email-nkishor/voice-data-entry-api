import { Router } from 'express';
import { AuthRequest, authMiddleware, requirePermission } from '../middleware/auth.middleware';
import {
  bulkMarkAttendance,
  getAttendanceSummary,
  getDailyAttendanceGrid,
  listAttendance,
  markAttendance,
  updateAttendanceRecord,
} from '../services/attendance.service';
import { AttendanceContextType } from '../types';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('attendance', 'view'), (req: AuthRequest, res) => {
  const filters = {
    date: req.query.date as string | undefined,
    groupId: req.query.groupId ? Number(req.query.groupId) : undefined,
    studentId: req.query.studentId ? Number(req.query.studentId) : undefined,
    eventId: req.query.eventId ? Number(req.query.eventId) : undefined,
    contextType: req.query.contextType as AttendanceContextType | undefined,
    periodNumber: req.query.periodNumber ? Number(req.query.periodNumber) : undefined,
    fromDate: req.query.fromDate as string | undefined,
    toDate: req.query.toDate as string | undefined,
  };
  res.json(listAttendance(req.user!, filters));
});

router.get('/daily/:date/:groupId', requirePermission('attendance', 'view'), (req: AuthRequest, res) => {
  const date = String(req.params.date);
  res.json(getDailyAttendanceGrid(Number(req.params.groupId), date, req.user!));
});

router.get('/reports/summary', requirePermission('attendance', 'view'), (req, res) => {
  const summary = getAttendanceSummary({
    organizationId: 1,
    groupId: req.query.groupId ? Number(req.query.groupId) : undefined,
    fromDate: req.query.fromDate as string | undefined,
    toDate: req.query.toDate as string | undefined,
    contextType: req.query.contextType as AttendanceContextType | undefined,
  });
  res.json(summary);
});

router.post('/', requirePermission('attendance', 'mark'), (req: AuthRequest, res) => {
  const { studentId, attendanceDate, status } = req.body as {
    studentId?: number;
    attendanceDate?: string;
    status?: string;
  };
  if (!studentId || !attendanceDate || !status) {
    res.status(400).json({ error: 'studentId, attendanceDate, and status are required' });
    return;
  }
  const record = markAttendance(req.body, req.user!.id);
  res.status(201).json({
    id: record.id,
    studentId: record.student_id,
    groupId: record.group_id,
    eventId: record.event_id,
    attendanceDate: record.attendance_date,
    contextType: record.context_type,
    periodNumber: record.period_number,
    status: record.status,
    remarks: record.remarks,
    markedBy: record.marked_by,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  });
});

router.post('/bulk', requirePermission('attendance', 'mark'), (req: AuthRequest, res) => {
  const { groupId, attendanceDate, records } = req.body as {
    groupId?: number;
    attendanceDate?: string;
    records?: unknown[];
  };
  if (!groupId || !attendanceDate || !records?.length) {
    res.status(400).json({ error: 'groupId, attendanceDate, and records are required' });
    return;
  }
  res.status(201).json(bulkMarkAttendance(req.body, req.user!.id));
});

router.put('/:id', requirePermission('attendance', 'mark'), (req: AuthRequest, res) => {
  const updated = updateAttendanceRecord(Number(req.params.id), req.body, req.user!.id);
  if (!updated) {
    res.status(404).json({ error: 'Attendance record not found' });
    return;
  }
  res.json(updated);
});

export default router;
