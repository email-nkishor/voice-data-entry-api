import {
  AttendanceFilters,
  AttendanceRecord,
  AuditLog,
  Award,
  AwardFilters,
  Certificate,
  CertificateFilters,
  CertificateTemplate,
  CustomFieldDefinition,
  CustomFieldFilters,
  CustomFieldValue,
  Event,
  EventFilters,
  EventParticipant,
  GroupStudent,
  LookupMap,
  LookupOption,
  Organization,
  Permission,
  RolePermission,
  Student,
  StudentActivity,
  StudentGroup,
  TeacherGroupAssignment,
  User,
  UserStudentLink,
  Parent,
  ParentStudentMapping,
  ParentNotificationPreferences,
  VoiceEntry,
  VoiceEntryEdit,
  VoiceEntryFilters,
} from '../types';

export type DbDriver = 'json' | 'sqlite';

export type IdTable =
  | 'users'
  | 'studentGroups'
  | 'students'
  | 'studentActivities'
  | 'organizations'
  | 'permissions'
  | 'rolePermissions'
  | 'userStudentLinks'
  | 'parents'
  | 'parentStudentMappings'
  | 'parentNotificationPreferences'
  | 'groupStudents'
  | 'teacherGroupAssignments'
  | 'events'
  | 'eventParticipants'
  | 'attendanceRecords'
  | 'certificateTemplates'
  | 'certificates'
  | 'awards'
  | 'voiceEntries'
  | 'voiceEntryEdits'
  | 'customFieldDefinitions'
  | 'customFieldValues'
  | 'auditLogs';

export interface DbRepository {
  readonly driver: DbDriver;

  nextId(table: IdTable): number;

  // Organizations
  getOrganization(id?: number): Organization | undefined;
  insertOrganization(org: Organization): void;
  updateOrganization(org: Organization): boolean;
  countOrganizations(): number;

  // Users
  findUserByEmail(email: string): User | undefined;
  findUserById(id: number): User | undefined;
  listUsers(organizationId?: number): User[];
  insertUser(user: User): void;
  updateUser(user: User): boolean;
  deleteUser(id: number): boolean;
  countUsers(): number;

  // User-student links
  linkParentToStudent(link: UserStudentLink): void;
  unlinkParentFromStudent(userId: number, studentId: number): boolean;
  getLinkedStudents(userId: number): UserStudentLink[];
  getLinkedStudentIds(userId: number): number[];
  listUserStudentLinksUpdatedSince(since: Date, organizationId?: number): UserStudentLink[];

  // Parents
  listParents(organizationId?: number): Parent[];
  listParentsUpdatedSince(since: Date, organizationId?: number): Parent[];
  getParentById(id: number): Parent | undefined;
  getParentByUserId(userId: number): Parent | undefined;
  getParentByClientId(clientId: number): Parent | undefined;
  insertParent(parent: Parent): void;
  updateParent(parent: Parent): boolean;
  countParents(): number;

  // Parent-student mappings
  listParentMappings(parentId?: number, studentId?: number): ParentStudentMapping[];
  listParentMappingsUpdatedSince(since: Date, organizationId?: number): ParentStudentMapping[];
  getParentMapping(parentId: number, studentId: number): ParentStudentMapping | undefined;
  insertParentMapping(mapping: ParentStudentMapping): void;
  deleteParentMapping(parentId: number, studentId: number): boolean;
  getStudentIdsForParentUser(userId: number): number[];

  // Parent notification preferences
  getParentNotificationPreferences(parentId: number): ParentNotificationPreferences | undefined;
  upsertParentNotificationPreferences(prefs: ParentNotificationPreferences): ParentNotificationPreferences;
  listParentNotificationPreferencesUpdatedSince(since: Date, organizationId?: number): ParentNotificationPreferences[];

  // Permissions
  listPermissions(): Permission[];
  insertPermission(permission: Permission): void;
  countPermissions(): number;
  listRolePermissions(role?: string): RolePermission[];
  insertRolePermission(rp: RolePermission): void;
  countRolePermissions(): number;
  seedPermissionsAndRoles(
    permissions: Permission[],
    rolePermissions: RolePermission[]
  ): void;

  // Teacher assignments
  assignTeacherToGroup(assignment: TeacherGroupAssignment): void;
  getTeacherGroupIds(userId: number): number[];

  // Groups
  listGroups(): StudentGroup[];
  listGroupsCreatedSince(since: Date): StudentGroup[];
  findGroupByClientId(clientId: number): StudentGroup | undefined;
  insertGroup(group: StudentGroup): void;
  updateGroup(group: StudentGroup): boolean;
  deleteGroup(id: number): boolean;
  findGroupById(id: number): StudentGroup | undefined;
  countGroups(): number;

  // Group-student assignments
  assignStudentToGroup(record: GroupStudent): void;
  unassignStudentFromGroup(groupId: number, studentId: number): boolean;
  listGroupStudents(groupId: number): GroupStudent[];
  listStudentGroups(studentId: number): GroupStudent[];

  // Students
  listStudents(groupId?: number, organizationId?: number): Student[];
  listStudentsUpdatedSince(since: Date): Student[];
  listStudentsByIds(ids: number[]): Student[];
  getStudentById(id: number): Student | undefined;
  getStudentByClientId(clientId: number): Student | undefined;
  insertStudent(student: Student): void;
  updateStudentRecord(student: Student): boolean;
  deleteStudent(id: number): boolean;

  // Activities
  insertActivity(activity: StudentActivity): void;
  listActivities(studentId?: number, limit?: number): StudentActivity[];
  deleteActivitiesByStudentId(studentId: number): void;

  // Events
  listEvents(filters?: EventFilters): Event[];
  listEventsUpdatedSince(since: Date, organizationId?: number): Event[];
  getEventById(id: number): Event | undefined;
  getEventByClientId(clientId: number): Event | undefined;
  insertEvent(event: Event): void;
  updateEvent(event: Event): boolean;
  deleteEvent(id: number): boolean;

  // Event participants
  addEventParticipant(participant: EventParticipant): void;
  removeEventParticipant(eventId: number, studentId: number): boolean;
  listEventParticipants(eventId: number): EventParticipant[];

  // Attendance
  listAttendance(filters?: AttendanceFilters): AttendanceRecord[];
  listAttendanceUpdatedSince(since: Date, organizationId?: number): AttendanceRecord[];
  getAttendanceById(id: number): AttendanceRecord | undefined;
  getAttendanceByClientId(clientId: number): AttendanceRecord | undefined;
  insertAttendance(record: AttendanceRecord): void;
  updateAttendance(record: AttendanceRecord): boolean;
  upsertAttendance(record: AttendanceRecord): AttendanceRecord;
  deleteAttendance(id: number): boolean;

  // Custom field definitions
  listCustomFieldDefinitions(filters?: CustomFieldFilters): CustomFieldDefinition[];
  listCustomFieldDefinitionsUpdatedSince(since: Date, organizationId?: number): CustomFieldDefinition[];
  getCustomFieldDefinitionById(id: number): CustomFieldDefinition | undefined;
  getCustomFieldDefinitionByName(
    organizationId: number,
    entityType: string,
    fieldName: string
  ): CustomFieldDefinition | undefined;
  insertCustomFieldDefinition(definition: CustomFieldDefinition): void;
  updateCustomFieldDefinition(definition: CustomFieldDefinition): boolean;
  deleteCustomFieldDefinition(id: number): boolean;

  // Custom field values
  listCustomFieldValues(entityType: string, entityId: number): CustomFieldValue[];
  listCustomFieldValuesUpdatedSince(since: Date, organizationId?: number): CustomFieldValue[];
  upsertCustomFieldValue(value: CustomFieldValue): CustomFieldValue;
  deleteCustomFieldValuesForEntity(entityType: string, entityId: number): void;

  // Audit logs
  insertAuditLog(log: AuditLog): void;
  listAuditLogs(entityType?: string, entityId?: number, limit?: number): AuditLog[];

  // Voice entries
  listVoiceEntries(filters?: VoiceEntryFilters): VoiceEntry[];
  listVoiceEntriesUpdatedSince(since: Date, organizationId?: number): VoiceEntry[];
  getVoiceEntryById(id: number): VoiceEntry | undefined;
  getVoiceEntryByClientId(clientId: number): VoiceEntry | undefined;
  insertVoiceEntry(entry: VoiceEntry): void;
  updateVoiceEntry(entry: VoiceEntry): boolean;
  deleteVoiceEntry(id: number): boolean;
  countVoiceEntries(filters?: VoiceEntryFilters): number;

  // Voice entry edits
  listVoiceEntryEdits(voiceEntryId: number): VoiceEntryEdit[];
  insertVoiceEntryEdit(edit: VoiceEntryEdit): void;

  // Certificate templates
  listCertificateTemplates(organizationId?: number, includeInactive?: boolean): CertificateTemplate[];
  listCertificateTemplatesUpdatedSince(since: Date, organizationId?: number): CertificateTemplate[];
  getCertificateTemplateById(id: number): CertificateTemplate | undefined;
  getCertificateTemplateByClientId(clientId: number): CertificateTemplate | undefined;
  insertCertificateTemplate(template: CertificateTemplate): void;
  updateCertificateTemplate(template: CertificateTemplate): boolean;

  // Certificates
  listCertificates(filters?: CertificateFilters): Certificate[];
  listCertificatesUpdatedSince(since: Date, organizationId?: number): Certificate[];
  getCertificateById(id: number): Certificate | undefined;
  getCertificateByClientId(clientId: number): Certificate | undefined;
  getCertificateByVerificationCode(code: string): Certificate | undefined;
  getCertificateByNumber(organizationId: number, certificateNumber: string): Certificate | undefined;
  countCertificates(filters?: CertificateFilters): number;
  insertCertificate(certificate: Certificate): void;
  updateCertificate(certificate: Certificate): boolean;

  // Awards
  listAwards(filters?: AwardFilters): Award[];
  listAwardsUpdatedSince(since: Date, organizationId?: number): Award[];
  getAwardById(id: number): Award | undefined;
  getAwardByClientId(clientId: number): Award | undefined;
  getAwardByVerificationCode(code: string): Award | undefined;
  countAwards(filters?: AwardFilters): number;
  insertAward(award: Award): void;
  updateAward(award: Award): boolean;

  // Lookups
  getAllLookups(): LookupMap;
  getLookupCategory(category: string): LookupOption[] | null;
  seedLookups(defaults: LookupMap): void;
  countLookups(): number;
}
