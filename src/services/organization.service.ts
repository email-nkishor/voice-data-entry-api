import { getRepository } from '../db/database';
import { Organization, OrganizationSettings } from '../types';

export function parseOrganizationSettings(org: Organization): OrganizationSettings {
  if (!org.settings_json) {
    return {};
  }
  try {
    return JSON.parse(org.settings_json) as OrganizationSettings;
  } catch {
    return {};
  }
}

export function isParentPortalEnabled(organizationId = 1): boolean {
  const repo = getRepository();
  const org = repo.getOrganization(organizationId);
  if (!org) {
    return false;
  }
  return parseOrganizationSettings(org).parentPortalEnabled === true;
}

export function isParentAttendanceEnabled(organizationId = 1): boolean {
  const repo = getRepository();
  const org = repo.getOrganization(organizationId);
  if (!org) {
    return false;
  }
  const settings = parseOrganizationSettings(org);
  return settings.parentPortalEnabled === true && settings.parentAttendanceEnabled === true;
}

export function getCurrentOrganization(): Organization {
  const repo = getRepository();
  const org = repo.getOrganization(1);
  if (org) {
    return org;
  }
  throw new Error('Default organization not found');
}

export function seedDefaultOrganization(): void {
  const repo = getRepository();
  if (repo.countOrganizations() > 0) {
    return;
  }
  const now = new Date().toISOString();
  repo.insertOrganization({
    id: 1,
    name: 'Default Institute',
    code: 'DEFAULT',
    settings_json: JSON.stringify({
      timezone: 'Asia/Kolkata',
      academicYear: '2025-26',
      parentPortalEnabled: true,
      parentAttendanceEnabled: true,
    }),
    created_at: now,
    updated_at: now,
  });
}

export function updateOrganizationSettings(settings: Record<string, unknown>): Organization {
  const repo = getRepository();
  const org = getCurrentOrganization();
  const updated: Organization = {
    ...org,
    settings_json: JSON.stringify(settings),
    updated_at: new Date().toISOString(),
  };
  repo.updateOrganization(updated);
  return updated;
}

export function organizationToApi(org: Organization) {
  const settings = parseOrganizationSettings(org);
  return {
    id: org.id,
    name: org.name,
    code: org.code,
    settings,
    parentPortalEnabled: settings.parentPortalEnabled === true,
    parentAttendanceEnabled: settings.parentAttendanceEnabled === true,
    createdAt: org.created_at,
    updatedAt: org.updated_at,
  };
}
