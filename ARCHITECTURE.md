# Voice Data Entry — Architecture & Redesign Reference

> **Last updated:** June 2025  
> **Scope:** Full-stack redesign for extensible SIS modules — organizations, RBAC, attendance, events, certificates, voice history, custom fields, reporting, and parent/student portals.

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Design Principles](#2-design-principles)
3. [Database Schema](#3-database-schema)
4. [RBAC & Data Access Matrix](#4-rbac--data-access-matrix)
5. [API Design](#5-api-design)
6. [UI / Information Architecture](#6-ui--information-architecture)
7. [Offline Sync Strategy](#7-offline-sync-strategy)
8. [Reporting Architecture](#8-reporting-architecture)
9. [Implementation Phases](#9-implementation-phases)
10. [Migration from POC](#10-migration-from-poc)

---

## 1. Current State Summary

### What existed before redesign

| Layer | Before |
|-------|--------|
| **API** | Node/Express/TS, 5 tables, 20 endpoints, JWT with 3 roles |
| **DB** | Dual driver: JSON file or SQLite — no migrations, no multi-tenancy |
| **Web** | Angular 20, Dexie IndexedDB, offline-first |
| **Voice** | Stateless proxy (Whisper + Gemini) — nothing persisted |
| **RBAC** | Route-level `requireRoles()` only |
| **Custom fields** | Opaque `students.custom_data` JSON |

### Target platform modules

- Organizations (multi-tenant foundation)
- Students, Groups, Events
- Attendance (daily, period, event)
- Certificates & Awards
- Voice Entry History
- Custom Fields (EAV per organization)
- Reporting & Analytics
- Parent & Student portals

---

## 2. Design Principles

1. **Organization as root tenant** — every entity has `organization_id`; one DB file = one org today, multi-org later without schema change.
2. **Permission matrix, not hardcoded roles** — `permissions` + `role_permissions` tables; middleware checks `module:action`.
3. **Module registry pattern** — each module registers entity types for sync, reporting, and voice entry.
4. **EAV for custom fields** — `custom_field_definitions` + `custom_field_values` instead of opaque JSON.
5. **Unified audit trail** — `audit_logs` for all entities; `voice_entries` for voice-specific history.
6. **Polymorphic attendance** — one `attendance_records` table with `context_type` (`daily`, `period`, `event`).
7. **Scoped access layer** — service methods apply row-level filters (self, child, group, org) based on role.

---

## 3. Database Schema

### Entity Relationship Overview

```
organizations
  ├── users
  ├── students
  ├── student_groups
  ├── events
  ├── lookup_options
  └── custom_field_definitions

users ←→ user_student_links ←→ students   (parent ↔ child)
users ←→ teacher_group_assignments ←→ student_groups

student_groups ←→ group_students ←→ students   (M:N assign)

students → attendance_records ← events (optional context)
students → certificates
students → voice_entries
students → custom_field_values
```

### Core Tables

#### `organizations`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| code | TEXT UNIQUE | e.g. `SCH001` |
| settings_json | TEXT | timezone, academic year, branding |
| created_at, updated_at | TEXT | ISO 8601 |

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| organization_id | INTEGER FK | |
| email | TEXT NOT NULL | UNIQUE per org |
| password_hash | TEXT | |
| name | TEXT | |
| role | TEXT | `admin`, `clerk`, `admission_clerk`, `teacher`, `student`, `parent` |
| status | TEXT | `active`, `inactive`, `pending` |
| linked_student_id | INTEGER FK nullable | For `student` role |
| created_at | TEXT | |

#### `user_student_links` (Parent ↔ Child)
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| organization_id | INTEGER FK | |
| user_id | INTEGER FK → users | Parent user |
| student_id | INTEGER FK → students | Child |
| relationship | TEXT | `father`, `mother`, `guardian` |
| is_primary | INTEGER | 0/1 |

#### `students`
Core fields plus `organization_id`. Legacy `custom_data` is migrated to EAV on student create/update.

#### `student_groups`
Same as before + `organization_id`.

#### `group_students` (Assign Students — M:N)
| Column | Type | Notes |
|--------|------|-------|
| group_id, student_id | FK | UNIQUE(group_id, student_id) |
| assigned_at, assigned_by | | |

#### `teacher_group_assignments`
Teachers see students in assigned groups only.

### Attendance Module

#### `attendance_records`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | AttendanceId |
| organization_id | INTEGER FK | |
| student_id | INTEGER FK | |
| group_id | INTEGER FK nullable | |
| event_id | INTEGER FK nullable | |
| attendance_date | TEXT NOT NULL | |
| context_type | TEXT | `daily`, `period`, `event` |
| period_number | INTEGER nullable | 1–8 for period-wise |
| status | TEXT | `present`, `absent`, `late`, `excused` |
| remarks | TEXT nullable | |
| marked_by | INTEGER FK → users | |
| client_id | INTEGER nullable | Offline sync |
| created_at, updated_at | TEXT | |

### Events Module

#### `events`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| organization_id | INTEGER FK | |
| title, description | TEXT | |
| event_type | TEXT | `academic`, `sports`, `cultural`, `other` |
| start_date, end_date | TEXT | |
| location | TEXT | |
| group_id | INTEGER FK nullable | |
| created_by | INTEGER FK | |
| status | TEXT | `draft`, `published`, `completed`, `cancelled` |

#### `event_participants`
| event_id, student_id | UNIQUE pair |
| registration_status | `registered`, `attended`, `absent` |

### Certificates & Awards

#### `certificates`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | CertificateId |
| student_id | INTEGER FK | |
| certificate_name | TEXT | |
| award_type | TEXT | |
| issue_date | TEXT | |
| issued_by | TEXT | |
| attachment_url | TEXT nullable | |
| verification_code | TEXT UNIQUE | Public verification |

### Voice Entry History

#### `voice_entries`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | VoiceEntryId |
| student_id | INTEGER FK nullable | |
| entity_type, entity_id | | Linked record after save |
| module_code | TEXT | |
| transcript | TEXT | Original speech |
| processed_json | TEXT | Extracted fields |
| audio_url | TEXT nullable | Future |
| speech_engine | TEXT | |
| status | TEXT | `draft`, `processed`, `saved`, `failed` |
| created_by | INTEGER FK | |
| created_at, modified_at | TEXT | |

#### `voice_entry_edits`
Field-level edit audit for voice entries.

### Custom Fields (Organization-Specific)

#### `custom_field_definitions`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | CustomFieldId |
| organization_id | INTEGER FK | |
| entity_type | TEXT | `student` (extensible) |
| field_name, field_label | TEXT | |
| field_type | TEXT | `text`, `number`, `date`, `dropdown`, `multiselect` |
| is_required | INTEGER | |
| default_value | TEXT nullable | |
| validation_rules_json | TEXT | |
| display_order | INTEGER | |

#### `custom_field_values`
EAV values keyed by `(field_definition_id, entity_type, entity_id)`.

### RBAC Tables

#### `permissions`
| module | action | e.g. `student:create`, `attendance:view` |

#### `role_permissions`
| role | permission_id | scope (`all`, `assigned_groups`, `self`, `children`) |

---

## 4. RBAC & Data Access Matrix

| Module | Admin | Clerk | Teacher | Student | Parent |
|--------|:-----:|:-----:|:-------:|:-------:|:------:|
| Create Student | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Student | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Student | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Students | ✅ | ✅ | ✅ assigned | Self only | ❌ |
| Create Group | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modify Group | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign Students | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Event | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Event | ✅ | ✅ | ✅ assigned | Own only | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mark Attendance | ✅ | ✅ | ✅ assigned | ❌ | ❌ |
| View Attendance | ✅ | ✅ | ✅ assigned | Self only | Child only |
| Create Certificate | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Certificates | ✅ | ✅ | ✅ assigned | Self only | Child only |
| Voice Entry (create) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Voice Entry (view) | ✅ | ✅ | ❌ | Self only | ❌ |
| Custom Fields (manage) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reports & Dashboard | ✅ | ✅ | ✅ limited | ❌ | Child summary |
| View Child Profile | — | — | — | — | ✅ |
| View Child Events | — | — | — | — | ✅ |
| View Child Achievements | — | — | — | — | ✅ |

> `admission_clerk` is treated as alias for `clerk` in permission checks.

---

## 5. API Design

### Route Structure (`/api/v1/` or `/api/`)

```
auth/           login, me (with permissions), change-password
organizations/  current org settings
users/          CRUD + link-student (admin)
students/       CRUD, stats, approve, activities, /me (student role)
student-groups/ CRUD, assign-students
events/         CRUD, participants
attendance/     list, daily grid, bulk mark, reports, export
certificates/   CRUD, upload, verify/:code
voice-entries/  CRUD, search, edit history
custom-fields/  definitions + values
reports/        dashboard widgets, typed reports
lookups/        dropdown data
sync/           push, pull (all entity types)
speech/         whisper, gemini-extract (stateless)
```

### Authorization

```typescript
requirePermission('student', 'create')
requirePermission('attendance', 'view')  // applies scope from role_permissions
```

Scoped queries:
- **Student role:** `GET /students/me`
- **Parent role:** only linked children via `user_student_links`
- **Teacher role:** filter by `teacher_group_assignments`

---

## 6. UI / Information Architecture

```
App Shell (sync bar + role-aware nav)
├── Dashboard (role-specific)
├── Students (list, add, edit, view, columns)
├── Groups (list, create, edit, assign)
├── Events (list, create, participants, event attendance)
├── Attendance (daily grid, period, reports, export)
├── Certificates (list, create, upload, verify)
├── Voice History (search, audit)
├── Reports & Analytics
├── Admin (users, custom fields, org settings) — admin only
└── Parent Portal (child selector, profile, attendance, events, achievements)
```

### Angular Routes

| Path | Module | Roles |
|------|--------|-------|
| `/dashboard` | Role-aware landing | All |
| `/student/*` | Student SIS | Staff |
| `/events/*` | Events | Staff |
| `/attendance/*` | Attendance | Staff |
| `/admin/*` | User management | Admin |
| `/parent/*` | Parent portal | Parent |

### Dexie Schema (v4+)

IndexedDB tables mirror server entities: `organizations`, `events`, `eventParticipants`, `attendanceRecords`, `certificates`, `voiceEntries`, `customFieldDefinitions`, `customFieldValues`, `userStudentLinks`.

---

## 7. Offline Sync Strategy

### SyncPushItem entities

```
student | studentGroup | attendance | event | certificate | voiceEntry | customFieldValue
```

### Pull response

```json
{
  "since": "ISO timestamp",
  "entities": {
    "students": [],
    "studentGroups": [],
    "attendance": [],
    "events": [],
    "certificates": [],
    "customFieldDefinitions": [],
    "voiceEntries": []
  },
  "stats": {}
}
```

---

## 8. Reporting Architecture

```
Sources (students, attendance, events, certificates, voice_entries)
  → Query Layer (SQL / JSON filter)
  → Aggregator (counts, percentages)
  → Dashboard Widgets | Report Pages | Exporter (CSV/Excel)
  → Future BI webhook
```

**Dashboard widgets:** totalStudents, activeStudents, totalGroups, totalEvents, voiceEntries, certificates, awards; trend charts; activity feed; quick actions; export center (CSV/Excel/audit).

**API:** `GET /api/reports/overview`, `/students`, `/voice`, `/certificates`, `/awards`, `/events`, `/activity`, `GET /api/reports/export/:entity?format=csv|excel`.

**RBAC scopes:** `all` (admin/clerk), `assigned_groups` (teacher), `children` (parent), `self` (student).

---

## 9. Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **1 — Foundation** | Organizations, RBAC, permissions, user management, migrations | ✅ In progress |
| **2 — Events** | Events CRUD, group assign/update, participants | ✅ In progress |
| **3 — Attendance** | Daily/period/event marking, bulk, reports | ✅ In progress |
| **4 — Custom Fields** | EAV schema, admin UI, form renderer, sync, audit | ✅ Complete |
| **5 — Voice History** | Persist voice entries, audit UI | Planned |
| **6 — Certificates** | CRUD, upload, verification | Planned |
| **7 — Reporting** | Dashboard KPIs, analytics modules, trends, activity feed, exports, RBAC scopes | ✅ Complete |
| **8 — Parent Portal** | Configurable parent portal, child-scoped APIs, dashboard, offline cache | ✅ Complete |
| **9 — Sync v2** | RBAC-scoped pull, entity push (attendance/event/award), sync-scope service | ✅ Complete |
| **10 — Parent Attendance** | Configurable `parentAttendanceEnabled`, child-scoped attendance API, absence alerts | ✅ Complete |

---

## 10. Migration from POC

### Database

1. `schema_version` table tracks migration version.
2. SQLite: `ALTER TABLE ADD COLUMN` for existing tables; `CREATE TABLE IF NOT EXISTS` for new.
3. JSON driver: merge missing keys on load; default `organization_id = 1`.
4. Seed default organization, permissions, role_permissions on first run.

### API backward compatibility

- `admission_clerk` role alias → `clerk` permissions
- `client_id` column retained for offline sync
- Existing student/group/sync endpoints unchanged; new endpoints additive

### Frontend

- Extend `AuthUser` with `permissions[]` and `linkedStudents[]`
- `PermissionService` drives nav visibility and button states
- `roleGuard` applied to admin and parent routes

---

## Repositories

| Repo | Path |
|------|------|
| Frontend | `voice-data-entry-web/` |
| API | `voice-data-entry-api/voice-data-entry-api/` |

## Default Demo Users (after Phase 1)

| Email | Password | Role |
|-------|----------|------|
| admin@institute.local | admin123 | admin |
| clerk@institute.local | clerk123 | clerk |
| teacher@institute.local | teacher123 | teacher |
| parent@institute.local | parent123 | parent |
| student@institute.local | student123 | student |
