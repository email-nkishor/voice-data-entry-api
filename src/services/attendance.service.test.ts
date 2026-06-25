import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function freshDbPath(): string {
  return path.join(os.tmpdir(), `vde-att-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

describe('attendance.service', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = freshDbPath();
    process.env.DB_DRIVER = 'json';
    process.env.DB_PATH = dbPath;
    vi.resetModules();
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  async function seedAttendance() {
    const db = await import('../db/database');
    db.resetDatabaseForTests();
    const repo = db.getRepository();
    const now = new Date().toISOString();

    repo.upsertAttendance({
      id: 1,
      organization_id: 1,
      student_id: 10,
      group_id: null,
      event_id: null,
      attendance_date: '2026-06-10',
      context_type: 'daily',
      period_number: null,
      status: 'present',
      remarks: null,
      marked_by: 1,
      client_id: null,
      created_at: now,
      updated_at: now,
    });
    repo.upsertAttendance({
      id: 2,
      organization_id: 1,
      student_id: 10,
      group_id: null,
      event_id: null,
      attendance_date: '2026-06-11',
      context_type: 'daily',
      period_number: null,
      status: 'absent',
      remarks: null,
      marked_by: 1,
      client_id: null,
      created_at: now,
      updated_at: now,
    });
    repo.upsertAttendance({
      id: 3,
      organization_id: 1,
      student_id: 11,
      group_id: 1,
      event_id: null,
      attendance_date: '2026-06-10',
      context_type: 'daily',
      period_number: null,
      status: 'present',
      remarks: null,
      marked_by: 1,
      client_id: null,
      created_at: now,
      updated_at: now,
    });

    return import('./attendance.service');
  }

  it('getAttendanceSummary calculates counts and percentage', async () => {
    const { getAttendanceSummary } = await seedAttendance();
    const summary = getAttendanceSummary({
      organizationId: 1,
      studentId: 10,
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    });
    expect(summary.total).toBe(2);
    expect(summary.present).toBe(1);
    expect(summary.absent).toBe(1);
    expect(summary.percentage).toBe(50);
  });

  it('listAttendance filters parent to linked children', async () => {
    const attendanceSvc = await seedAttendance();
    const records = attendanceSvc.listAttendance(
      {
        id: 4,
        email: 'parent@test.local',
        name: 'Parent',
        role: 'parent',
        organizationId: 1,
        permissions: [],
        linkedStudentIds: [10],
      },
      { organizationId: 1 }
    );
    expect(records.every((r) => r.studentId === 10)).toBe(true);
    expect(records.length).toBe(2);
  });

  it('canViewStudentAttendance validates parent child link', async () => {
    const { canViewStudentAttendance } = await seedAttendance();
    const parent = {
      id: 4,
      email: 'parent@test.local',
      name: 'Parent',
      role: 'parent' as const,
      organizationId: 1,
      permissions: [],
      linkedStudentIds: [10],
    };
    expect(canViewStudentAttendance(parent, 10)).toBe(true);
    expect(canViewStudentAttendance(parent, 11)).toBe(false);
  });
});
