import { getRepository } from '../db/database';
import {
  AuthUser,
  ParentDashboardData,
  ParentNotificationPreferences,
} from '../types';
import { logAudit } from './audit.service';
import { listAwards } from './award.service';
import { listCertificates } from './certificate.service';
import { getEntityValues } from './custom-field.service';
import { listEvents } from './event.service';
import {
  ensureDefaultNotificationPreferences,
  ensureParentForUser,
  notificationPreferencesToApi,
  parentToApi,
} from './parent-entity.service';
import { canAccessStudent } from './permission.service';
import { formatCode, getStudentById, studentToApi } from './student.service';
import { listVoiceEntries } from './voice-entry.service';
import { findUserById } from './auth.service';
import { getAttendanceSummary, listAttendance } from './attendance.service';
import { isParentAttendanceEnabled } from './organization.service';

export function logParentAction(
  user: AuthUser,
  action: string,
  entityType: string,
  entityId: number,
  changes: Record<string, unknown> | null = null
): void {
  logAudit(entityType, entityId, action, changes, user.id, user.organizationId);
}

export function assertChildAccess(user: AuthUser, studentId: number): void {
  if (!canAccessStudent(user, studentId)) {
    throw new Error('Access denied to this student');
  }
}

export function getParentProfile(user: AuthUser) {
  const dbUser = findUserById(user.id);
  if (!dbUser) {
    throw new Error('User not found');
  }
  const parent = ensureParentForUser(dbUser);
  const mappings = getRepository().listParentMappings(parent.id);
  return {
    ...parentToApi(parent),
    childrenCount: mappings.length,
  };
}

export function listParentChildren(user: AuthUser) {
  const dbUser = findUserById(user.id);
  if (!dbUser) {
    throw new Error('User not found');
  }
  const parent = ensureParentForUser(dbUser);
  const repo = getRepository();
  const mappings = repo.listParentMappings(parent.id);

  return mappings
    .map((mapping) => {
      const student = repo.getStudentById(mapping.student_id);
      if (!student || !canAccessStudent(user, student.id)) {
        return null;
      }
      return {
        studentId: student.id,
        code: formatCode(student.id),
        name: student.name,
        class: student.class,
        section: student.section,
        status: student.status,
        relationshipType: mapping.relationship_type,
        isPrimaryContact: mapping.is_primary_contact === 1,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}

function resolveSelectedStudentId(user: AuthUser, studentId?: number): number | null {
  const children = listParentChildren(user);
  if (!children.length) {
    return null;
  }
  if (studentId && children.some((c) => c.studentId === studentId)) {
    return studentId;
  }
  const primary = children.find((c) => c.isPrimaryContact);
  return primary?.studentId ?? children[0].studentId;
}

export function getParentDashboard(user: AuthUser, studentId?: number): ParentDashboardData {
  const children = listParentChildren(user);
  const selectedStudentId = resolveSelectedStudentId(user, studentId);
  const repo = getRepository();
  const today = new Date().toISOString().slice(0, 10);

  let upcomingEvents: ReturnType<typeof listEvents> = [];
  let recentCertificates: Awaited<ReturnType<typeof listCertificates>>['items'] = [];
  let recentAwards: Awaited<ReturnType<typeof listAwards>>['items'] = [];
  let recentVoiceEntries: Awaited<ReturnType<typeof listVoiceEntries>>['items'] = [];
  let certificatesCount = 0;
  let awardsCount = 0;
  let voiceEntriesCount = 0;
  let eventsParticipated = 0;
  let attendanceSummary: ParentDashboardData['attendanceSummary'];
  let recentAbsences: ParentDashboardData['recentAbsences'];
  let absenceAlertCount = 0;
  const parentAttendanceEnabled = isParentAttendanceEnabled(user.organizationId);

  if (selectedStudentId) {
    logParentAction(user, 'parent_dashboard_view', 'student', selectedStudentId, {
      studentId: selectedStudentId,
    });

    upcomingEvents = listEvents(user, { status: 'published' })
      .filter((e) => e.startDate >= today)
      .slice(0, 5);

    const certsResult = listCertificates(user, { studentId: selectedStudentId, limit: 100 });
    certificatesCount = certsResult.total;
    recentCertificates = certsResult.items.slice(0, 5);

    const awardsResult = listAwards(user, { studentId: selectedStudentId, limit: 100 });
    awardsCount = awardsResult.total;
    recentAwards = awardsResult.items.slice(0, 5);

    const voiceResult = listVoiceEntries(user, { studentId: selectedStudentId, limit: 100 });
    voiceEntriesCount = voiceResult.total;
    recentVoiceEntries = voiceResult.items.slice(0, 5);

    const allEvents = listEvents(user);
    eventsParticipated = allEvents.filter((event) => {
      const participants = repo.listEventParticipants(event.id);
      return participants.some((p) => p.student_id === selectedStudentId);
    }).length;

    if (parentAttendanceEnabled) {
      const today = new Date();
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const fromDate = monthAgo.toISOString().slice(0, 10);
      const toDate = today.toISOString().slice(0, 10);
      const weekFrom = weekAgo.toISOString().slice(0, 10);

      attendanceSummary = getAttendanceSummary({
        organizationId: user.organizationId,
        studentId: selectedStudentId,
        fromDate,
        toDate,
      });

      const monthRecords = listAttendance(user, {
        organizationId: user.organizationId,
        studentId: selectedStudentId,
        fromDate,
        toDate,
      });
      recentAbsences = monthRecords
        .filter((r) => r.status === 'absent' || r.status === 'late')
        .slice(0, 5);

      absenceAlertCount = monthRecords.filter(
        (r) =>
          r.status === 'absent' &&
          r.attendanceDate >= weekFrom &&
          r.attendanceDate <= toDate
      ).length;
    }
  }

  return {
    childrenCount: children.length,
    selectedStudentId,
    children,
    upcomingEvents,
    recentCertificates,
    recentAwards,
    recentVoiceEntries,
    achievementSummary: {
      certificates: certificatesCount,
      awards: awardsCount,
      voiceEntries: voiceEntriesCount,
      eventsParticipated,
    },
    parentAttendanceEnabled,
    attendanceComingSoon: !parentAttendanceEnabled,
    attendanceSummary,
    recentAbsences,
    absenceAlertCount,
  };
}

export function getChildDetail(user: AuthUser, studentId: number) {
  assertChildAccess(user, studentId);
  logParentAction(user, 'parent_child_profile_view', 'student', studentId);

  const student = getStudentById(studentId);
  if (!student) {
    throw new Error('Student not found');
  }

  const repo = getRepository();
  const groups = repo.listStudentGroups(studentId).map((m) => {
    const group = repo.findGroupById(m.group_id);
    return group
      ? { id: group.id, name: group.name, assignedAt: m.assigned_at }
      : null;
  }).filter((g): g is NonNullable<typeof g> => g != null);

  const primaryGroup = student.group_id ? repo.findGroupById(student.group_id) : undefined;

  return {
    ...studentToApi(student, true),
    grade: student.class,
    groups,
    primaryGroup: primaryGroup ? { id: primaryGroup.id, name: primaryGroup.name } : null,
    customFields: getEntityValues('student', studentId),
    readOnly: true,
  };
}

export function getChildVoiceHistory(user: AuthUser, studentId: number) {
  assertChildAccess(user, studentId);
  logParentAction(user, 'parent_voice_history_view', 'student', studentId);
  const result = listVoiceEntries(user, { studentId, limit: 50 });
  return result.items.map((api) => {
    const entry = getRepository().getVoiceEntryById(api.id);
    let processedSummary: Record<string, unknown> | null = null;
    if (entry?.processed_json) {
      try {
        processedSummary = JSON.parse(entry.processed_json) as Record<string, unknown>;
      } catch {
        processedSummary = null;
      }
    }
    return {
      ...api,
      processedSummary,
    };
  });
}

export function getChildCertificates(user: AuthUser, studentId: number) {
  assertChildAccess(user, studentId);
  logParentAction(user, 'parent_certificates_view', 'student', studentId);
  return listCertificates(user, { studentId, limit: 100 }).items;
}

export function getChildAwards(user: AuthUser, studentId: number) {
  assertChildAccess(user, studentId);
  logParentAction(user, 'parent_awards_view', 'student', studentId);
  return listAwards(user, { studentId, limit: 100 }).items;
}

export function getChildEvents(user: AuthUser, studentId: number) {
  assertChildAccess(user, studentId);
  logParentAction(user, 'parent_events_view', 'student', studentId);
  const repo = getRepository();
  const events = listEvents(user);
  return events
    .filter((event) => {
      const participants = repo.listEventParticipants(event.id);
      return participants.some((p) => p.student_id === studentId);
    })
    .map((event) => {
      const participants = repo.listEventParticipants(event.id);
      const registration = participants.find((p) => p.student_id === studentId);
      return {
        ...event,
        registrationStatus: registration?.registration_status ?? 'registered',
      };
    });
}

export function getChildAttendance(
  user: AuthUser,
  studentId: number,
  filters: { fromDate?: string; toDate?: string; contextType?: string } = {}
) {
  assertChildAccess(user, studentId);
  if (!isParentAttendanceEnabled(user.organizationId)) {
    throw new Error('Parent attendance views are not enabled');
  }
  logParentAction(user, 'parent_attendance_view', 'student', studentId, filters as Record<string, unknown>);
  return listAttendance(user, {
    organizationId: user.organizationId,
    studentId,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    contextType: filters.contextType as never,
  });
}

export function getChildAttendanceSummary(
  user: AuthUser,
  studentId: number,
  filters: { fromDate?: string; toDate?: string } = {}
) {
  assertChildAccess(user, studentId);
  if (!isParentAttendanceEnabled(user.organizationId)) {
    throw new Error('Parent attendance views are not enabled');
  }
  logParentAction(user, 'parent_attendance_summary_view', 'student', studentId, filters as Record<string, unknown>);
  return getAttendanceSummary({
    organizationId: user.organizationId,
    studentId,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
  });
}

export function getNotificationPreferences(user: AuthUser) {
  const dbUser = findUserById(user.id);
  if (!dbUser) {
    throw new Error('User not found');
  }
  const parent = ensureParentForUser(dbUser);
  const prefs = ensureDefaultNotificationPreferences(parent);
  return notificationPreferencesToApi(prefs);
}

export function updateNotificationPreferences(
  user: AuthUser,
  input: Partial<{
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    eventAssigned: boolean;
    certificateIssued: boolean;
    awardAdded: boolean;
    attendanceAlert: boolean;
  }>
) {
  const dbUser = findUserById(user.id);
  if (!dbUser) {
    throw new Error('User not found');
  }
  const repo = getRepository();
  const parent = ensureParentForUser(dbUser);
  const existing = ensureDefaultNotificationPreferences(parent);

  const updated: ParentNotificationPreferences = {
    ...existing,
    email_enabled: input.emailEnabled !== undefined ? (input.emailEnabled ? 1 : 0) : existing.email_enabled,
    sms_enabled: input.smsEnabled !== undefined ? (input.smsEnabled ? 1 : 0) : existing.sms_enabled,
    push_enabled: input.pushEnabled !== undefined ? (input.pushEnabled ? 1 : 0) : existing.push_enabled,
    event_assigned: input.eventAssigned !== undefined ? (input.eventAssigned ? 1 : 0) : existing.event_assigned,
    certificate_issued: input.certificateIssued !== undefined ? (input.certificateIssued ? 1 : 0) : existing.certificate_issued,
    award_added: input.awardAdded !== undefined ? (input.awardAdded ? 1 : 0) : existing.award_added,
    attendance_alert: input.attendanceAlert !== undefined ? (input.attendanceAlert ? 1 : 0) : existing.attendance_alert,
    updated_at: new Date().toISOString(),
  };

  repo.upsertParentNotificationPreferences(updated);
  logParentAction(user, 'parent_notification_prefs_update', 'parent', parent.id, input as Record<string, unknown>);
  return notificationPreferencesToApi(updated);
}

export function logCertificateDownload(user: AuthUser, certificateId: number): void {
  logParentAction(user, 'parent_certificate_download', 'certificate', certificateId);
}

export function logCertificateVerification(user: AuthUser, certificateId: number): void {
  logParentAction(user, 'parent_certificate_verify', 'certificate', certificateId);
}
