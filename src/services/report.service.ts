import { getRepository } from '../db/database';
import {
  AuthUser,
  DashboardOverview,
  ReportActivityItem,
  ReportExportEntity,
  ReportFilters,
  ReportKpis,
  ReportQuickAction,
  Student,
  TrendPoint,
} from '../types';
import { listAuditLogs } from './audit.service';
import { getPermissionScope, userHasPermission } from './permission.service';
import { formatCode, getStudentById } from './student.service';

const ACTIVE_STUDENT_STATUSES = new Set(['active', 'approved', 'new_admission', 'pending_approval']);

interface ReportScope {
  scope: string;
  studentIds: number[] | 'all';
  groupIds: number[] | 'all';
}

export function canViewReports(user: AuthUser): boolean {
  return (
    userHasPermission(user, 'report', 'view') || userHasPermission(user, 'report', 'view_self')
  );
}

function resolveReportScope(user: AuthUser): ReportScope {
  const scope =
    getPermissionScope(user, 'report', 'view')
    ?? getPermissionScope(user, 'report', 'view_self')
    ?? 'all';

  const repo = getRepository();

  if (scope === 'all') {
    return { scope, studentIds: 'all', groupIds: 'all' };
  }

  if (scope === 'self' || scope === 'children') {
    return { scope, studentIds: user.linkedStudentIds, groupIds: [] as number[] };
  }

  if (scope === 'assigned_groups') {
    const groupIds = repo.getTeacherGroupIds(user.id);
    const students = repo.listStudents(undefined, user.organizationId);
    const studentIds = students
      .filter((s) => {
        if (s.group_id && groupIds.includes(s.group_id)) {
          return true;
        }
        return repo.listStudentGroups(s.id).some((m) => groupIds.includes(m.group_id));
      })
      .map((s) => s.id);
    return { scope, studentIds, groupIds };
  }

  return { scope, studentIds: [], groupIds: [] };
}

function filterStudents(students: Student[], scope: ReportScope, filters: ReportFilters): Student[] {
  let items = students;

  if (scope.studentIds !== 'all') {
    const allowed = new Set(scope.studentIds);
    items = items.filter((s) => allowed.has(s.id));
  }

  if (filters.groupId) {
    items = items.filter((s) => s.group_id === filters.groupId);
  }

  if (filters.studentId) {
    items = items.filter((s) => s.id === filters.studentId);
  }

  return items;
}

function filterByStudentIds<T extends { student_id: number | null }>(
  items: T[],
  studentIds: number[] | 'all'
): T[] {
  if (studentIds === 'all') {
    return items;
  }
  const allowed = new Set(studentIds);
  return items.filter((i) => i.student_id != null && allowed.has(i.student_id));
}

function inDateRange(dateStr: string, filters: ReportFilters): boolean {
  const day = dateStr.slice(0, 10);
  if (filters.fromDate && day < filters.fromDate) {
    return false;
  }
  if (filters.toDate && day > filters.toDate) {
    return false;
  }
  return true;
}

function buildDailyTrend(dates: string[], filters: ReportFilters): TrendPoint[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    if (!inDateRange(d, filters)) {
      continue;
    }
    const day = d.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function countByField<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = getter(item) || 'other';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function getScopedStudents(user: AuthUser, filters: ReportFilters): Student[] {
  const repo = getRepository();
  const scope = resolveReportScope(user);
  const all = repo.listStudents(filters.groupId, user.organizationId);
  return filterStudents(all, scope, filters);
}

function getQuickActions(user: AuthUser): ReportQuickAction[] {
  const actions: ReportQuickAction[] = [];
  if (userHasPermission(user, 'student', 'create')) {
    actions.push({ label: 'Add Student', route: '/student/add', icon: 'fa-user-plus' });
  }
  if (userHasPermission(user, 'voice', 'create')) {
    actions.push({ label: 'Voice Entry', route: '/student/add', icon: 'fa-microphone' });
  }
  if (userHasPermission(user, 'certificate', 'create')) {
    actions.push({ label: 'Issue Certificate', route: '/certificates/issue', icon: 'fa-award' });
  }
  if (userHasPermission(user, 'event', 'create')) {
    actions.push({ label: 'Create Event', route: '/events/add', icon: 'fa-calendar-plus' });
  }
  if (userHasPermission(user, 'attendance', 'mark')) {
    actions.push({ label: 'Mark Attendance', route: '/attendance/daily', icon: 'fa-clipboard-check' });
  }
  if (userHasPermission(user, 'award', 'create') || userHasPermission(user, 'award', 'recommend')) {
    actions.push({ label: 'Add Award', route: '/certificates/awards/add', icon: 'fa-trophy' });
  }
  return actions;
}

function buildActivityFeed(user: AuthUser, scope: ReportScope, limit = 15): ReportActivityItem[] {
  const repo = getRepository();
  const items: ReportActivityItem[] = [];

  let activities = repo.listActivities(undefined, limit * 2);
  if (scope.studentIds !== 'all') {
    const allowed = new Set(scope.studentIds);
    activities = activities.filter((a) => allowed.has(a.student_id));
  }

  for (const a of activities.slice(0, limit)) {
    const student = getStudentById(a.student_id);
    items.push({
      id: `activity-${a.id}`,
      type: 'student_activity',
      title: student?.name ?? 'Student',
      description: a.message,
      entityType: 'student',
      entityId: a.student_id,
      occurredAt: a.action_date,
    });
  }

  const audits = listAuditLogs(undefined, undefined, limit);
  for (const log of audits) {
    items.push({
      id: `audit-${log.id}`,
      type: 'audit',
      title: log.action,
      description: `${log.entityType} #${log.entityId}`,
      entityType: log.entityType,
      entityId: log.entityId,
      occurredAt: log.createdAt,
    });
  }

  return items
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}

export function getDashboardOverview(user: AuthUser, filters: ReportFilters = {}): DashboardOverview {
  const repo = getRepository();
  const scope = resolveReportScope(user);
  const students = getScopedStudents(user, filters);

  let voiceEntries = repo.listVoiceEntries({
    organizationId: user.organizationId,
    limit: 10000,
  }).filter((e) => inDateRange(e.created_at, filters));
  voiceEntries = filterByStudentIds(voiceEntries, scope.studentIds);
  if (filters.studentId) {
    voiceEntries = voiceEntries.filter((e) => e.student_id === filters.studentId);
  }

  let certificates = repo.listCertificates({
    organizationId: user.organizationId,
    limit: 10000,
  }).filter((c) => inDateRange(c.issue_date, filters));
  certificates = filterByStudentIds(certificates, scope.studentIds);

  let awards = repo.listAwards({
    organizationId: user.organizationId,
    limit: 10000,
  }).filter((a) => inDateRange(a.award_date, filters));
  awards = filterByStudentIds(awards, scope.studentIds);

  let events = repo.listEvents({ organizationId: user.organizationId });
  events = events.filter((e) => inDateRange(e.start_date, filters));
  if (scope.groupIds !== 'all' && scope.groupIds.length > 0) {
    const allowedGroups = scope.groupIds;
    events = events.filter((e) => !e.group_id || allowedGroups.includes(e.group_id!));
  }

  let groups = repo.listGroups().filter((g) => g.organization_id === user.organizationId);
  if (scope.groupIds !== 'all') {
    const allowed = new Set(scope.groupIds);
    groups = groups.filter((g) => allowed.has(g.id));
  }
  if (filters.groupId) {
    groups = groups.filter((g) => g.id === filters.groupId);
  }

  const kpis: ReportKpis = {
    totalStudents: students.length,
    activeStudents: students.filter((s) => ACTIVE_STUDENT_STATUSES.has(s.status)).length,
    totalGroups: groups.length,
    totalEvents: events.length,
    voiceEntries: voiceEntries.length,
    certificates: certificates.filter((c) => c.status !== 'revoked').length,
    awards: awards.filter((a) => a.status !== 'revoked').length,
  };

  return {
    organizationId: user.organizationId,
    scope: scope.scope,
    generatedAt: new Date().toISOString(),
    filters,
    kpis,
    trends: {
      students: buildDailyTrend(students.map((s) => s.created_at), filters),
      voiceEntries: buildDailyTrend(voiceEntries.map((e) => e.created_at), filters),
      certificates: buildDailyTrend(certificates.map((c) => c.issue_date), filters),
      awards: buildDailyTrend(awards.map((a) => a.award_date), filters),
      events: buildDailyTrend(events.map((e) => e.start_date), filters),
    },
    breakdowns: {
      studentsByStatus: countByField(students, (s) => s.status),
      studentsByClass: countByField(students, (s) => s.class?.trim() || 'Unassigned'),
      voiceByModule: countByField(voiceEntries, (e) => e.module_code),
      certificatesByType: countByField(certificates, (c) => c.certificate_type),
      awardsByCategory: countByField(awards, (a) => a.category),
      eventsByType: countByField(events, (e) => e.event_type),
    },
    recentActivity: buildActivityFeed(user, scope),
    quickActions: getQuickActions(user),
  };
}

export function getStudentAnalytics(user: AuthUser, filters: ReportFilters = {}) {
  const students = getScopedStudents(user, filters);
  return {
    total: students.length,
    active: students.filter((s) => ACTIVE_STUDENT_STATUSES.has(s.status)).length,
    byStatus: countByField(students, (s) => s.status),
    byClass: countByField(students, (s) => s.class?.trim() || 'Unassigned'),
    byFeeStatus: countByField(students, (s) => s.fee_status),
    trend: buildDailyTrend(students.map((s) => s.created_at), filters),
    recent: students
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        code: formatCode(s.id),
        name: s.name,
        class: s.class,
        status: s.status,
        createdAt: s.created_at,
      })),
  };
}

export function getVoiceAnalytics(user: AuthUser, filters: ReportFilters = {}) {
  const scope = resolveReportScope(user);
  const repo = getRepository();
  let entries = repo.listVoiceEntries({ organizationId: user.organizationId, limit: 10000 });
  entries = entries.filter((e) => inDateRange(e.created_at, filters));
  entries = filterByStudentIds(entries, scope.studentIds);
  if (filters.studentId) {
    entries = entries.filter((e) => e.student_id === filters.studentId);
  }

  return {
    total: entries.length,
    byStatus: countByField(entries, (e) => e.status),
    byModule: countByField(entries, (e) => e.module_code),
    byEngine: countByField(entries, (e) => e.speech_engine ?? 'unknown'),
    trend: buildDailyTrend(entries.map((e) => e.created_at), filters),
    recent: entries
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        moduleCode: e.module_code,
        studentId: e.student_id,
        status: e.status,
        preview: e.transcript.slice(0, 80),
        createdAt: e.created_at,
      })),
  };
}

export function getCertificateAnalytics(user: AuthUser, filters: ReportFilters = {}) {
  const scope = resolveReportScope(user);
  const repo = getRepository();
  let certs = repo.listCertificates({ organizationId: user.organizationId, limit: 10000 });
  certs = certs.filter((c) => inDateRange(c.issue_date, filters));
  certs = filterByStudentIds(certs, scope.studentIds);

  return {
    total: certs.length,
    issued: certs.filter((c) => c.status === 'issued').length,
    revoked: certs.filter((c) => c.status === 'revoked').length,
    byType: countByField(certs, (c) => c.certificate_type),
    byStatus: countByField(certs, (c) => c.status),
    trend: buildDailyTrend(certs.map((c) => c.issue_date), filters),
    recent: certs
      .sort((a, b) => b.issue_date.localeCompare(a.issue_date))
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        number: c.certificate_number,
        title: c.title,
        studentId: c.student_id,
        issueDate: c.issue_date,
        status: c.status,
      })),
  };
}

export function getAwardAnalytics(user: AuthUser, filters: ReportFilters = {}) {
  const scope = resolveReportScope(user);
  const repo = getRepository();
  let awards = repo.listAwards({ organizationId: user.organizationId, limit: 10000 });
  awards = awards.filter((a) => inDateRange(a.award_date, filters));
  awards = filterByStudentIds(awards, scope.studentIds);

  return {
    total: awards.length,
    byCategory: countByField(awards, (a) => a.category),
    byStatus: countByField(awards, (a) => a.status),
    trend: buildDailyTrend(awards.map((a) => a.award_date), filters),
    recent: awards
      .sort((a, b) => b.award_date.localeCompare(a.award_date))
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        studentId: a.student_id,
        awardDate: a.award_date,
        status: a.status,
      })),
  };
}

export function getEventAnalytics(user: AuthUser, filters: ReportFilters = {}) {
  const scope = resolveReportScope(user);
  const repo = getRepository();
  let events = repo.listEvents({ organizationId: user.organizationId });
  events = events.filter((e) => inDateRange(e.start_date, filters));
  if (scope.groupIds !== 'all' && scope.groupIds.length > 0) {
    const allowedGroups = scope.groupIds;
    events = events.filter((e) => !e.group_id || allowedGroups.includes(e.group_id!));
  }

  return {
    total: events.length,
    byType: countByField(events, (e) => e.event_type),
    byStatus: countByField(events, (e) => e.status),
    trend: buildDailyTrend(events.map((e) => e.start_date), filters),
    upcoming: events
      .filter((e) => e.start_date >= new Date().toISOString().slice(0, 10))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        title: e.title,
        eventType: e.event_type,
        startDate: e.start_date,
        status: e.status,
      })),
  };
}

export function getActivityFeed(user: AuthUser, limit = 20) {
  const scope = resolveReportScope(user);
  return buildActivityFeed(user, scope, limit);
}

export function exportReportData(
  user: AuthUser,
  entity: ReportExportEntity,
  filters: ReportFilters = {}
): { filename: string; content: string; mimeType: string } {
  const scope = resolveReportScope(user);
  const repo = getRepository();
  let rows: Record<string, unknown>[] = [];
  let filename = `${entity}-export`;

  switch (entity) {
    case 'students':
      rows = getScopedStudents(user, filters).map((s) => ({
        id: s.id,
        code: formatCode(s.id),
        name: s.name,
        class: s.class,
        rollNo: s.roll_no,
        status: s.status,
        feeStatus: s.fee_status,
        groupId: s.group_id,
        createdAt: s.created_at,
      }));
      break;
    case 'voice': {
      let entries = repo.listVoiceEntries({ organizationId: user.organizationId, limit: 10000 });
      entries = entries.filter((e) => inDateRange(e.created_at, filters));
      entries = filterByStudentIds(entries, scope.studentIds);
      rows = entries.map((e) => ({
        id: e.id,
        studentId: e.student_id,
        moduleCode: e.module_code,
        status: e.status,
        speechEngine: e.speech_engine,
        transcript: e.transcript,
        createdAt: e.created_at,
      }));
      break;
    }
    case 'certificates': {
      let certs = repo.listCertificates({ organizationId: user.organizationId, limit: 10000 });
      certs = certs.filter((c) => inDateRange(c.issue_date, filters));
      certs = filterByStudentIds(certs, scope.studentIds);
      rows = certs.map((c) => ({
        id: c.id,
        number: c.certificate_number,
        title: c.title,
        studentId: c.student_id,
        type: c.certificate_type,
        status: c.status,
        issueDate: c.issue_date,
        verificationCode: c.verification_code,
      }));
      break;
    }
    case 'awards': {
      let awards = repo.listAwards({ organizationId: user.organizationId, limit: 10000 });
      awards = awards.filter((a) => inDateRange(a.award_date, filters));
      awards = filterByStudentIds(awards, scope.studentIds);
      rows = awards.map((a) => ({
        id: a.id,
        title: a.title,
        studentId: a.student_id,
        category: a.category,
        status: a.status,
        awardDate: a.award_date,
      }));
      break;
    }
    case 'events': {
      let events = repo.listEvents({ organizationId: user.organizationId });
      events = events.filter((e) => inDateRange(e.start_date, filters));
      rows = events.map((e) => ({
        id: e.id,
        title: e.title,
        eventType: e.event_type,
        startDate: e.start_date,
        endDate: e.end_date,
        status: e.status,
        location: e.location,
      }));
      break;
    }
    case 'audit':
      rows = listAuditLogs(undefined, undefined, 500).map((l) => ({
        id: l.id,
        entityType: l.entityType,
        entityId: l.entityId,
        action: l.action,
        userId: l.userId,
        createdAt: l.createdAt,
      }));
      filename = 'audit-log-export';
      break;
  }

  if (filters.fromDate || filters.toDate) {
    filename += `-${filters.fromDate ?? 'start'}-to-${filters.toDate ?? 'end'}`;
  }

  return {
    filename: `${filename}.csv`,
    content: toCsv(rows),
    mimeType: 'text/csv; charset=utf-8',
  };
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) {
    return '';
  }
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    const str = val == null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export function exportReportExcel(
  user: AuthUser,
  entity: ReportExportEntity,
  filters: ReportFilters = {}
): { filename: string; content: string; mimeType: string } {
  const csv = exportReportData(user, entity, filters);
  return {
    ...csv,
    filename: csv.filename.replace('.csv', '.xls'),
    mimeType: 'application/vnd.ms-excel; charset=utf-8',
  };
}
