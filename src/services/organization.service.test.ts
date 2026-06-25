import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Organization } from '../types';

function freshDbPath(): string {
  return path.join(os.tmpdir(), `vde-org-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

describe('organization.service', () => {
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

  async function loadServices() {
    const db = await import('../db/database');
    db.resetDatabaseForTests();
    return import('./organization.service');
  }

  it('parseOrganizationSettings returns empty object for missing json', async () => {
    const { parseOrganizationSettings } = await loadServices();
    const org: Organization = {
      id: 1,
      name: 'Test',
      code: 'T',
      settings_json: null,
      created_at: '',
      updated_at: '',
    };
    expect(parseOrganizationSettings(org)).toEqual({});
  });

  it('parseOrganizationSettings parses valid json', async () => {
    const { parseOrganizationSettings } = await loadServices();
    const org: Organization = {
      id: 1,
      name: 'Test',
      code: 'T',
      settings_json: JSON.stringify({ parentPortalEnabled: true, parentAttendanceEnabled: false }),
      created_at: '',
      updated_at: '',
    };
    expect(parseOrganizationSettings(org)).toEqual({
      parentPortalEnabled: true,
      parentAttendanceEnabled: false,
    });
  });

  it('organizationToApi flattens parent feature flags', async () => {
    const { organizationToApi } = await loadServices();
    const org: Organization = {
      id: 1,
      name: 'Institute',
      code: 'INS',
      settings_json: JSON.stringify({
        parentPortalEnabled: true,
        parentAttendanceEnabled: true,
        timezone: 'Asia/Kolkata',
      }),
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    };
    const api = organizationToApi(org);
    expect(api.parentPortalEnabled).toBe(true);
    expect(api.parentAttendanceEnabled).toBe(true);
    expect(api.settings.timezone).toBe('Asia/Kolkata');
  });

  it('isParentAttendanceEnabled requires portal and attendance flags', async () => {
    const svc = await loadServices();
    const { getRepository } = await import('../db/database');
    const repo = getRepository();
    const now = new Date().toISOString();

    repo.insertOrganization({
      id: 1,
      name: 'School',
      code: 'SCH',
      settings_json: JSON.stringify({
        parentPortalEnabled: true,
        parentAttendanceEnabled: true,
      }),
      created_at: now,
      updated_at: now,
    });
    expect(svc.isParentAttendanceEnabled(1)).toBe(true);

    repo.updateOrganization({
      id: 1,
      name: 'School',
      code: 'SCH',
      settings_json: JSON.stringify({
        parentPortalEnabled: true,
        parentAttendanceEnabled: false,
      }),
      created_at: now,
      updated_at: now,
    });
    expect(svc.isParentAttendanceEnabled(1)).toBe(false);

    repo.updateOrganization({
      id: 1,
      name: 'School',
      code: 'SCH',
      settings_json: JSON.stringify({
        parentPortalEnabled: false,
        parentAttendanceEnabled: true,
      }),
      created_at: now,
      updated_at: now,
    });
    expect(svc.isParentAttendanceEnabled(1)).toBe(false);
  });

  it('seedDefaultOrganization is idempotent', async () => {
    const svc = await loadServices();
    const { getRepository } = await import('../db/database');
    svc.seedDefaultOrganization();
    svc.seedDefaultOrganization();
    expect(getRepository().countOrganizations()).toBe(1);
    expect(svc.isParentPortalEnabled(1)).toBe(true);
    expect(svc.isParentAttendanceEnabled(1)).toBe(true);
  });
});
