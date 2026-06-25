import { getRepository } from '../db/database';
import { FeeStatus, Student, StudentActivity, StudentGroup, StudentStatus, CustomFieldValueInput } from '../types';
import { getEntityValues, migrateStudentCustomDataToEav, saveEntityValues } from './custom-field.service';

export function listStudents(groupId?: number): Student[] {
  return getRepository().listStudents(groupId);
}

export function getStudentById(id: number): Student | undefined {
  return getRepository().getStudentById(id);
}

export function getStudentByClientId(clientId: number): Student | undefined {
  return getRepository().getStudentByClientId(clientId);
}

export interface StudentInput {
  name: string;
  class?: string;
  rollNo?: string;
  mobile?: string;
  address?: string;
  admissionNo?: string;
  parentName?: string;
  parentMobile?: string;
  academicYear?: string;
  section?: string;
  status?: StudentStatus;
  feeStatus?: FeeStatus;
  groupId?: number;
  customData?: string;
  clientId?: number;
  customFields?: CustomFieldValueInput[];
}

export function createStudent(input: StudentInput, userId?: number): Student {
  const repo = getRepository();
  const now = new Date().toISOString();
  const id = repo.nextId('students');
  const student: Student = {
    id,
    organization_id: 1,
    name: input.name,
    class: input.class ?? '',
    roll_no: input.rollNo ?? '',
    mobile: input.mobile ?? '',
    address: input.address ?? '',
    admission_no: input.admissionNo ?? null,
    parent_name: input.parentName ?? null,
    parent_mobile: input.parentMobile ?? null,
    academic_year: input.academicYear ?? null,
    section: input.section ?? null,
    status: input.status ?? 'new_admission',
    fee_status: input.feeStatus ?? 'not_applicable',
    group_id: input.groupId ?? null,
    custom_data: input.customData ?? null,
    client_id: input.clientId ?? null,
    created_at: now,
    updated_at: now,
  };
  repo.insertStudent(student);
  logActivity(id, 'create', `Student (${formatCode(id)}) created`, userId);

  if (input.customFields?.length) {
    saveEntityValues('student', id, input.customFields, userId);
  } else if (input.customData) {
    migrateStudentCustomDataToEav(id, input.customData);
  }

  return student;
}

export function updateStudent(
  id: number,
  input: Partial<StudentInput>,
  userId?: number
): Student | undefined {
  const repo = getRepository();
  const existing = repo.getStudentById(id);
  if (!existing) {
    return undefined;
  }

  const now = new Date().toISOString();
  const updated: Student = {
    ...existing,
    name: input.name ?? existing.name,
    class: input.class ?? existing.class,
    roll_no: input.rollNo ?? existing.roll_no,
    mobile: input.mobile ?? existing.mobile,
    address: input.address ?? existing.address,
    admission_no: input.admissionNo ?? existing.admission_no,
    parent_name: input.parentName ?? existing.parent_name,
    parent_mobile: input.parentMobile ?? existing.parent_mobile,
    academic_year: input.academicYear ?? existing.academic_year,
    section: input.section ?? existing.section,
    status: input.status ?? existing.status,
    fee_status: input.feeStatus ?? existing.fee_status,
    group_id: input.groupId ?? existing.group_id,
    custom_data: input.customData ?? existing.custom_data,
    updated_at: now,
  };
  repo.updateStudentRecord(updated);
  logActivity(id, 'update', `Student (${formatCode(id)}) updated`, userId);

  if (input.customFields?.length) {
    saveEntityValues('student', id, input.customFields, userId);
  } else if (input.customData) {
    migrateStudentCustomDataToEav(id, input.customData);
  }

  return updated;
}

export function deleteStudent(id: number, userId?: number): boolean {
  const repo = getRepository();
  const existing = repo.getStudentById(id);
  if (!existing) {
    return false;
  }
  logActivity(id, 'delete', `Student (${formatCode(id)}) deleted`, userId);
  return repo.deleteStudent(id);
}

export function approveAdmission(id: number, userId?: number): Student | undefined {
  const student = updateStudent(id, { status: 'active' }, userId);
  if (student) {
    logActivity(id, 'admission_approved', `Admission approved for ${student.name}`, userId);
  }
  return student;
}

export function logActivity(
  studentId: number,
  action: string,
  message: string,
  userId?: number
): void {
  const repo = getRepository();
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const id = repo.nextId('studentActivities');
  const activity: StudentActivity = {
    id,
    student_id: studentId,
    action,
    message,
    action_date: dateLabel,
    logged_date: dateLabel,
    user_id: userId ?? null,
  };
  repo.insertActivity(activity);
}

export function listActivities(studentId?: number, limit = 20): StudentActivity[] {
  return getRepository().listActivities(studentId, limit);
}

export function listGroups(): StudentGroup[] {
  return getRepository().listGroups();
}

export function createGroup(name: string, description?: string, clientId?: number): StudentGroup {
  const repo = getRepository();
  const id = repo.nextId('studentGroups');
  const group: StudentGroup = {
    id,
    organization_id: 1,
    name,
    description: description ?? null,
    is_default: 0,
    client_id: clientId ?? null,
    created_at: new Date().toISOString(),
  };
  repo.insertGroup(group);
  return group;
}

export function deleteGroup(id: number): boolean {
  return getRepository().deleteGroup(id);
}

export function updateGroup(
  id: number,
  name: string,
  description?: string
): StudentGroup | undefined {
  const repo = getRepository();
  const existing = repo.findGroupById(id);
  if (!existing) {
    return undefined;
  }
  const updated: StudentGroup = {
    ...existing,
    name: name.trim(),
    description: description?.trim() ?? existing.description,
  };
  repo.updateGroup(updated);
  return updated;
}

export function assignStudentsToGroup(
  groupId: number,
  studentIds: number[],
  assignedBy?: number
): number {
  const repo = getRepository();
  let count = 0;
  const now = new Date().toISOString();
  for (const studentId of studentIds) {
    const existing = repo.listGroupStudents(groupId);
    if (existing.some((g) => g.student_id === studentId)) {
      continue;
    }
    repo.assignStudentToGroup({
      id: repo.nextId('groupStudents'),
      organization_id: 1,
      group_id: groupId,
      student_id: studentId,
      assigned_at: now,
      assigned_by: assignedBy ?? null,
    });
    const student = repo.getStudentById(studentId);
    if (student && student.group_id !== groupId) {
      repo.updateStudentRecord({ ...student, group_id: groupId, updated_at: now });
    }
    count++;
  }
  return count;
}

export function getDashboardStats(groupId?: number) {
  const students = listStudents(groupId);
  const statusCounts: Record<string, number> = {};
  const classCounts: Record<string, number> = {};

  for (const s of students) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    const cls = s.class?.trim() || 'Unassigned';
    classCounts[cls] = (classCounts[cls] ?? 0) + 1;
  }

  const worklist = [
    {
      id: 'pending_approval',
      label: 'Pending Admission Approval',
      count: students.filter((s) => s.status === 'pending_approval').length,
    },
    {
      id: 'pending_docs',
      label: 'Pending Documents',
      count: students.filter((s) => s.status === 'pending_docs').length,
    },
    {
      id: 'new_admission',
      label: 'New Admissions',
      count: students.filter((s) => s.status === 'new_admission').length,
    },
  ];

  const alerts = [
    {
      id: 'fee_overdue',
      label: 'Fee Payment Overdue',
      count: students.filter((s) => s.fee_status === 'overdue').length,
    },
    {
      id: 'inactive',
      label: 'Inactive Students',
      count: students.filter((s) => s.status === 'inactive').length,
    },
  ];

  const activities = listActivities(undefined, 10).map((a) => {
    const student = getStudentById(a.student_id);
    return {
      id: String(a.id),
      studentId: a.student_id,
      studentCode: formatCode(a.student_id),
      studentName: student?.name ?? 'Unknown',
      message: a.message,
      actionDate: a.action_date,
      loggedDate: a.logged_date,
    };
  });

  const favorites = students.slice(0, 5).map((s) => ({
    id: String(s.id),
    studentId: s.id,
    title: `${s.name} — ${s.class || 'N/A'}`,
    date: new Date(s.created_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  }));

  return { total: students.length, statusCounts, classCounts, worklist, alerts, activities, favorites };
}

export function formatCode(id: number): string {
  return `STU${String(id).padStart(7, '0')}`;
}

export function studentToApi(student: Student, includeCustomFields = false) {
  const base = {
    id: student.id,
    name: student.name,
    class: student.class,
    rollNo: student.roll_no,
    mobile: student.mobile,
    address: student.address,
    admissionNo: student.admission_no,
    parentName: student.parent_name,
    parentMobile: student.parent_mobile,
    academicYear: student.academic_year,
    section: student.section,
    status: student.status,
    feeStatus: student.fee_status,
    groupId: student.group_id,
    customData: student.custom_data,
    clientId: student.client_id,
    createdDate: student.created_at,
    updatedDate: student.updated_at,
  };

  if (includeCustomFields) {
    return {
      ...base,
      customFields: getEntityValues('student', student.id),
    };
  }
  return base;
}

export function apiToStudentInput(body: Record<string, unknown>): StudentInput {
  return {
    name: String(body['name'] ?? ''),
    class: body['class'] != null ? String(body['class']) : undefined,
    rollNo: body['rollNo'] != null ? String(body['rollNo']) : undefined,
    mobile: body['mobile'] != null ? String(body['mobile']) : undefined,
    address: body['address'] != null ? String(body['address']) : undefined,
    admissionNo: body['admissionNo'] != null ? String(body['admissionNo']) : undefined,
    parentName: body['parentName'] != null ? String(body['parentName']) : undefined,
    parentMobile: body['parentMobile'] != null ? String(body['parentMobile']) : undefined,
    academicYear: body['academicYear'] != null ? String(body['academicYear']) : undefined,
    section: body['section'] != null ? String(body['section']) : undefined,
    status: body['status'] as StudentStatus | undefined,
    feeStatus: body['feeStatus'] as FeeStatus | undefined,
    groupId: body['groupId'] != null ? Number(body['groupId']) : undefined,
    customData: body['customData'] != null ? String(body['customData']) : undefined,
    clientId: body['clientId'] != null ? Number(body['clientId']) : undefined,
    customFields: body['customFields'] as StudentInput['customFields'],
  };
}
