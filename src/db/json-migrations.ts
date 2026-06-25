import { Organization, User } from '../types';

/** Shape used for JSON DB backfill (subset of full schema). */
export interface JsonDbBackfillTarget {
  organizations: Organization[];
  users: User[];
}

export function backfillUserRecord(user: User): boolean {
  let changed = false;
  if (!user.status) {
    user.status = 'active';
    changed = true;
  }
  if (user.organization_id == null) {
    user.organization_id = 1;
    changed = true;
  }
  if (user.linked_student_id === undefined) {
    user.linked_student_id = null;
    changed = true;
  }
  return changed;
}

export function backfillOrganizationSettings(org: Organization): boolean {
  let settings: Record<string, unknown> = {};
  if (org.settings_json) {
    try {
      settings = JSON.parse(org.settings_json) as Record<string, unknown>;
    } catch {
      settings = {};
    }
  }

  const merged = {
    timezone: 'Asia/Kolkata',
    academicYear: '2025-26',
    parentPortalEnabled: true,
    parentAttendanceEnabled: true,
    ...settings,
  };

  const nextJson = JSON.stringify(merged);
  if (org.settings_json !== nextJson) {
    org.settings_json = nextJson;
    return true;
  }
  return false;
}

export function runJsonBackfills(db: JsonDbBackfillTarget): boolean {
  let changed = false;

  for (const user of db.users) {
    if (backfillUserRecord(user)) {
      changed = true;
    }
  }

  for (const org of db.organizations) {
    if (backfillOrganizationSettings(org)) {
      changed = true;
    }
  }

  return changed;
}
