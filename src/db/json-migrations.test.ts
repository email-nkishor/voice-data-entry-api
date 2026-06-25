import { describe, expect, it } from 'vitest';
import { Organization, User } from '../types';
import { backfillUserRecord, runJsonBackfills } from './json-migrations';

describe('json-migrations', () => {
  it('backfillUserRecord sets active status and org defaults', () => {
    const user = {
      id: 1,
      email: 'clerk@institute.local',
      password_hash: 'hash',
      name: 'Clerk',
      role: 'clerk',
      created_at: '',
    } as User;

    expect(backfillUserRecord(user)).toBe(true);
    expect(user.status).toBe('active');
    expect(user.organization_id).toBe(1);
    expect(user.linked_student_id).toBeNull();
  });

  it('runJsonBackfills merges organization portal settings', () => {
    const org: Organization = {
      id: 1,
      name: 'School',
      code: 'SCH',
      settings_json: JSON.stringify({ timezone: 'Asia/Kolkata' }),
      created_at: '',
      updated_at: '',
    };
    const changed = runJsonBackfills({ organizations: [org], users: [] });
    expect(changed).toBe(true);
    const settings = JSON.parse(org.settings_json!) as Record<string, unknown>;
    expect(settings.parentPortalEnabled).toBe(true);
    expect(settings.parentAttendanceEnabled).toBe(true);
  });
});
