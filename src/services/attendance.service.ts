import { getRepository } from '../db/database';
import {
  AttendanceContextType,
  AttendanceFilters,
  AttendanceRecord,
  AttendanceStatus,
  AuthUser,
} from '../types';
import { canAccessStudent, getAccessibleGroupIds } from './permission.service';

export interface AttendanceInput {
  studentId: number;
  groupId?: number;
  eventId?: number;
  attendanceDate: string;
  contextType?: AttendanceContextType;
  periodNumber?: number;
  status: AttendanceStatus;
  remarks?: string;
  clientId?: number;
}

export interface BulkAttendanceInput {
  groupId: number;
  attendanceDate: string;
  contextType?: AttendanceContextType;
  periodNumber?: number;
  records: { studentId: number; status: AttendanceStatus; remarks?: string }[];
}

export function listAttendance(user: AuthUser, filters: AttendanceFilters = {}) {
  const repo = getRepository();
  const groupIds = getAccessibleGroupIds(user);

  let records = repo.listAttendance({
    ...filters,
    organizationId: user.organizationId,
  });

  if (groupIds !== 'all') {
    records = records.filter(
      (r) => !r.group_id || groupIds.includes(r.group_id)
    );
  }

  if (user.role === 'student') {
    const studentId = user.linkedStudentIds[0];
    records = studentId ? records.filter((r) => r.student_id === studentId) : [];
  }

  if (user.role === 'parent') {
    const childIds = new Set(user.linkedStudentIds);
    records = records.filter((r) => childIds.has(r.student_id));
  }

  return records.map(attendanceToApi);
}

export function markAttendance(input: AttendanceInput, userId: number): AttendanceRecord {
  const repo = getRepository();
  const now = new Date().toISOString();
  const record: AttendanceRecord = {
    id: repo.nextId('attendanceRecords'),
    organization_id: 1,
    student_id: input.studentId,
    group_id: input.groupId ?? null,
    event_id: input.eventId ?? null,
    attendance_date: input.attendanceDate,
    context_type: input.contextType ?? 'daily',
    period_number: input.periodNumber ?? null,
    status: input.status,
    remarks: input.remarks ?? null,
    marked_by: userId,
    client_id: input.clientId ?? null,
    created_at: now,
    updated_at: now,
  };
  return repo.upsertAttendance(record);
}

export function bulkMarkAttendance(input: BulkAttendanceInput, userId: number) {
  const results: AttendanceRecord[] = [];
  for (const item of input.records) {
    results.push(
      markAttendance(
        {
          studentId: item.studentId,
          groupId: input.groupId,
          attendanceDate: input.attendanceDate,
          contextType: input.contextType,
          periodNumber: input.periodNumber,
          status: item.status,
          remarks: item.remarks,
        },
        userId
      )
    );
  }
  return results.map(attendanceToApi);
}

export function getDailyAttendanceGrid(groupId: number, date: string, user: AuthUser) {
  const repo = getRepository();
  const students = repo.listStudents(groupId);
  const records = repo.listAttendance({
    organizationId: user.organizationId,
    groupId,
    date,
    contextType: 'daily',
  });
  const recordMap = new Map(records.map((r) => [r.student_id, r]));

  return students.map((student) => ({
    student: {
      id: student.id,
      name: student.name,
      rollNo: student.roll_no,
    },
    attendance: recordMap.has(student.id)
      ? attendanceToApi(recordMap.get(student.id)!)
      : null,
  }));
}

export function getAttendanceSummary(filters: AttendanceFilters) {
  const repo = getRepository();
  const records = repo.listAttendance(filters);
  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const late = records.filter((r) => r.status === 'late').length;
  const excused = records.filter((r) => r.status === 'excused').length;

  return {
    total,
    present,
    absent,
    late,
    excused,
    percentage: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
  };
}

export function updateAttendanceRecord(
  id: number,
  input: Partial<AttendanceInput>,
  userId: number
) {
  const repo = getRepository();
  const existing = repo.getAttendanceById(id);
  if (!existing) {
    return undefined;
  }
  const updated: AttendanceRecord = {
    ...existing,
    status: input.status ?? existing.status,
    remarks: input.remarks !== undefined ? (input.remarks ?? null) : existing.remarks,
    marked_by: userId,
    updated_at: new Date().toISOString(),
  };
  repo.updateAttendance(updated);
  return attendanceToApi(updated);
}

function attendanceToApi(record: AttendanceRecord) {
  return {
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
    clientId: record.client_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function canViewStudentAttendance(user: AuthUser, studentId: number): boolean {
  if (user.role === 'parent') {
    return user.linkedStudentIds.includes(studentId);
  }
  if (user.role === 'student') {
    return user.linkedStudentIds.includes(studentId);
  }
  return canAccessStudent(user, studentId);
}
