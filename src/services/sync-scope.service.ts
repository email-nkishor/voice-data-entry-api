import { getRepository } from '../db/database';
import { normalizeRole } from '../config/permissions';
import {
  AttendanceRecord,
  AuthUser,
  Award,
  Certificate,
  Event,
  Student,
  StudentGroup,
  VoiceEntry,
} from '../types';

export type ScopedStudentIds = number[] | 'all';

export function getScopedStudentIds(user: AuthUser): ScopedStudentIds {
  const role = normalizeRole(user.role);
  if (role === 'admin' || role === 'clerk') {
    return 'all';
  }
  if (user.role === 'teacher') {
    const repo = getRepository();
    const groupIds = repo.getTeacherGroupIds(user.id);
    const students = repo.listStudents(undefined, user.organizationId);
    return students
      .filter((student) => {
        if (student.group_id && groupIds.includes(student.group_id)) {
          return true;
        }
        return repo.listStudentGroups(student.id).some((m) => groupIds.includes(m.group_id));
      })
      .map((s) => s.id);
  }
  if (user.role === 'parent' || user.role === 'student') {
    return user.linkedStudentIds;
  }
  return [];
}

export function getScopedGroupIds(user: AuthUser): number[] | 'all' {
  const role = normalizeRole(user.role);
  if (role === 'admin' || role === 'clerk') {
    return 'all';
  }
  if (user.role === 'teacher') {
    return getRepository().getTeacherGroupIds(user.id);
  }
  return [];
}

function inStudentScope(studentId: number, scope: ScopedStudentIds): boolean {
  return scope === 'all' || scope.includes(studentId);
}

export function filterStudentsByScope(students: Student[], user: AuthUser): Student[] {
  const scope = getScopedStudentIds(user);
  if (scope === 'all') {
    return students;
  }
  return students.filter((s) => inStudentScope(s.id, scope));
}

export function filterGroupsByScope(groups: StudentGroup[], user: AuthUser): StudentGroup[] {
  const groupScope = getScopedGroupIds(user);
  if (groupScope === 'all') {
    return groups;
  }
  return groups.filter((g) => groupScope.includes(g.id));
}

export function filterEventsByScope(events: Event[], user: AuthUser): Event[] {
  const studentScope = getScopedStudentIds(user);
  const groupScope = getScopedGroupIds(user);
  if (studentScope === 'all' && groupScope === 'all') {
    return events;
  }

  const repo = getRepository();
  return events.filter((event) => {
    if (groupScope !== 'all' && event.group_id && groupScope.includes(event.group_id)) {
      return true;
    }
    if (studentScope !== 'all') {
      const participants = repo.listEventParticipants(event.id);
      return participants.some((p) => inStudentScope(p.student_id, studentScope));
    }
    return groupScope === 'all';
  });
}

export function filterAttendanceByScope(records: AttendanceRecord[], user: AuthUser): AttendanceRecord[] {
  const scope = getScopedStudentIds(user);
  if (scope === 'all') {
    return records;
  }
  return records.filter((r) => inStudentScope(r.student_id, scope));
}

export function filterVoiceByScope(entries: VoiceEntry[], user: AuthUser): VoiceEntry[] {
  const scope = getScopedStudentIds(user);
  if (scope === 'all') {
    return entries;
  }
  return entries.filter(
    (e) => e.student_id != null && inStudentScope(e.student_id, scope)
  );
}

export function filterCertificatesByScope(certs: Certificate[], user: AuthUser): Certificate[] {
  const scope = getScopedStudentIds(user);
  if (scope === 'all') {
    return certs;
  }
  return certs.filter((c) => inStudentScope(c.student_id, scope));
}

export function filterAwardsByScope(awards: Award[], user: AuthUser): Award[] {
  const scope = getScopedStudentIds(user);
  if (scope === 'all') {
    return awards;
  }
  return awards.filter((a) => inStudentScope(a.student_id, scope));
}
