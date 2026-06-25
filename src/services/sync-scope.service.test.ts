import { describe, expect, it } from 'vitest';
import { AuthUser, AttendanceRecord, Student } from '../types';
import {
  filterAttendanceByScope,
  filterStudentsByScope,
} from './sync-scope.service';

function parentUser(linkedStudentIds: number[]): AuthUser {
  return {
    id: 4,
    email: 'parent@test.local',
    name: 'Parent',
    role: 'parent',
    organizationId: 1,
    permissions: [{ key: 'parent:view_child_profile', scope: 'children' }],
    linkedStudentIds,
  };
}

function adminUser(): AuthUser {
  return {
    id: 1,
    email: 'admin@test.local',
    name: 'Admin',
    role: 'admin',
    organizationId: 1,
    permissions: [{ key: 'student:view', scope: 'all' }],
    linkedStudentIds: [],
  };
}

describe('sync-scope.service', () => {
  const students: Student[] = [
    {
      id: 1,
      organization_id: 1,
      name: 'A',
      class: '10',
      roll_no: '1',
      mobile: '1',
      address: 'x',
      admission_no: null,
      parent_name: null,
      parent_mobile: null,
      academic_year: null,
      section: null,
      status: 'active',
      fee_status: 'not_applicable',
      group_id: 1,
      custom_data: null,
      client_id: null,
      created_at: '',
      updated_at: '',
    },
    {
      id: 2,
      organization_id: 1,
      name: 'B',
      class: '10',
      roll_no: '2',
      mobile: '2',
      address: 'y',
      admission_no: null,
      parent_name: null,
      parent_mobile: null,
      academic_year: null,
      section: null,
      status: 'active',
      fee_status: 'not_applicable',
      group_id: 1,
      custom_data: null,
      client_id: null,
      created_at: '',
      updated_at: '',
    },
  ];

  const attendance: AttendanceRecord[] = [
    {
      id: 1,
      organization_id: 1,
      student_id: 1,
      group_id: 1,
      event_id: null,
      attendance_date: '2026-06-01',
      context_type: 'daily',
      period_number: null,
      status: 'present',
      remarks: null,
      marked_by: 1,
      client_id: null,
      created_at: '',
      updated_at: '',
    },
    {
      id: 2,
      organization_id: 1,
      student_id: 2,
      group_id: 1,
      event_id: null,
      attendance_date: '2026-06-01',
      context_type: 'daily',
      period_number: null,
      status: 'absent',
      remarks: null,
      marked_by: 1,
      client_id: null,
      created_at: '',
      updated_at: '',
    },
  ];

  it('filterStudentsByScope returns all students for admin', () => {
    expect(filterStudentsByScope(students, adminUser())).toHaveLength(2);
  });

  it('filterStudentsByScope limits parent to linked children', () => {
    const scoped = filterStudentsByScope(students, parentUser([1]));
    expect(scoped).toHaveLength(1);
    expect(scoped[0].id).toBe(1);
  });

  it('filterAttendanceByScope limits parent to linked children', () => {
    const scoped = filterAttendanceByScope(attendance, parentUser([2]));
    expect(scoped).toHaveLength(1);
    expect(scoped[0].student_id).toBe(2);
    expect(scoped[0].status).toBe('absent');
  });

  it('filterAttendanceByScope returns all records for admin', () => {
    expect(filterAttendanceByScope(attendance, adminUser())).toHaveLength(2);
  });
});
