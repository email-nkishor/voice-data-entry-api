export type UserRole = 'admin' | 'clerk' | 'admission_clerk' | 'teacher' | 'student' | 'parent';

export type ParentStatus = 'active' | 'inactive';

export type ParentRelationshipType = 'father' | 'mother' | 'guardian' | 'grandparent' | 'other';

export type UserStatus = 'active' | 'inactive' | 'pending';

export type StudentStatus =
  | 'pending_approval'
  | 'active'
  | 'on_leave'
  | 'graduated'
  | 'inactive'
  | 'pending_docs'
  | 'new_admission';

export type FeeStatus = 'paid' | 'partial' | 'overdue' | 'not_applicable';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type AttendanceContextType = 'daily' | 'period' | 'event';

export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled';

export type EventType = 'academic' | 'sports' | 'cultural' | 'other';

export type PermissionScope = 'all' | 'assigned_groups' | 'self' | 'children' | 'own';

export interface Organization {
  id: number;
  name: string;
  code: string;
  settings_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  organization_id: number;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  linked_student_id: number | null;
  created_at: string;
}

export interface UserStudentLink {
  id: number;
  organization_id: number;
  user_id: number;
  student_id: number;
  relationship: string;
  is_primary: number;
  created_at: string;
}

export interface Parent {
  id: number;
  organization_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  user_id: number | null;
  status: ParentStatus;
  client_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ParentStudentMapping {
  id: number;
  organization_id: number;
  parent_id: number;
  student_id: number;
  relationship_type: ParentRelationshipType;
  is_primary_contact: number;
  client_id: number | null;
  created_at: string;
}

export interface ParentNotificationPreferences {
  id: number;
  organization_id: number;
  parent_id: number;
  email_enabled: number;
  sms_enabled: number;
  push_enabled: number;
  event_assigned: number;
  certificate_issued: number;
  award_added: number;
  attendance_alert: number;
  client_id: number | null;
  updated_at: string;
}

export interface OrganizationSettings {
  timezone?: string;
  academicYear?: string;
  parentPortalEnabled?: boolean;
  parentAttendanceEnabled?: boolean;
}

export interface Permission {
  id: number;
  module: string;
  action: string;
  description: string;
}

export interface RolePermission {
  id: number;
  role: string;
  permission_id: number;
  scope: PermissionScope;
}

export interface StudentGroup {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  is_default: number;
  client_id: number | null;
  created_at: string;
}

export interface GroupStudent {
  id: number;
  organization_id: number;
  group_id: number;
  student_id: number;
  assigned_at: string;
  assigned_by: number | null;
}

export interface TeacherGroupAssignment {
  id: number;
  organization_id: number;
  user_id: number;
  group_id: number;
}

export interface Student {
  id: number;
  organization_id: number;
  name: string;
  class: string;
  roll_no: string;
  mobile: string;
  address: string;
  admission_no: string | null;
  parent_name: string | null;
  parent_mobile: string | null;
  academic_year: string | null;
  section: string | null;
  status: StudentStatus;
  fee_status: FeeStatus;
  group_id: number | null;
  custom_data: string | null;
  client_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface StudentActivity {
  id: number;
  student_id: number;
  action: string;
  message: string;
  action_date: string;
  logged_date: string;
  user_id: number | null;
}

export interface Event {
  id: number;
  organization_id: number;
  title: string;
  description: string | null;
  event_type: EventType;
  start_date: string;
  end_date: string | null;
  location: string | null;
  group_id: number | null;
  created_by: number | null;
  status: EventStatus;
  client_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventParticipant {
  id: number;
  event_id: number;
  student_id: number;
  registration_status: string;
}

export interface AttendanceRecord {
  id: number;
  organization_id: number;
  student_id: number;
  group_id: number | null;
  event_id: number | null;
  attendance_date: string;
  context_type: AttendanceContextType;
  period_number: number | null;
  status: AttendanceStatus;
  remarks: string | null;
  marked_by: number | null;
  client_id: number | null;
  created_at: string;
  updated_at: string;
}

export type CertificateType = 'achievement' | 'completion' | 'participation' | 'merit' | 'other';
export type CertificateStatus = 'draft' | 'issued' | 'revoked';

export interface Certificate {
  id: number;
  organization_id: number;
  student_id: number;
  template_id: number | null;
  certificate_number: string;
  certificate_type: CertificateType;
  title: string;
  description: string | null;
  certificate_name: string;
  award_type: string;
  issue_date: string;
  issued_by: string;
  attachment_url: string | null;
  verification_code: string | null;
  status: CertificateStatus;
  revoked_at: string | null;
  revoked_by: number | null;
  revoke_reason: string | null;
  created_by: number | null;
  client_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CertificateTemplate {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  certificate_type: CertificateType;
  template_url: string | null;
  is_active: number;
  created_by: number | null;
  client_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CertificateInput {
  studentId: number;
  templateId?: number | null;
  certificateType?: CertificateType;
  title: string;
  description?: string | null;
  issueDate: string;
  issuedBy: string;
  attachmentUrl?: string | null;
  status?: CertificateStatus;
  clientId?: number | null;
}

export interface CertificateTemplateInput {
  name: string;
  description?: string | null;
  certificateType?: CertificateType;
  templateUrl?: string | null;
  isActive?: boolean;
  clientId?: number | null;
}

export interface CertificateFilters {
  organizationId?: number;
  studentId?: number;
  certificateType?: CertificateType;
  status?: CertificateStatus;
  templateId?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export type AwardCategory = 'academic' | 'sports' | 'attendance' | 'custom';
export type AwardStatus = 'recommended' | 'approved' | 'issued' | 'revoked';

export interface Award {
  id: number;
  organization_id: number;
  student_id: number;
  category: AwardCategory;
  title: string;
  description: string | null;
  award_date: string;
  issued_by: string | null;
  attachment_url: string | null;
  certificate_id: number | null;
  status: AwardStatus;
  recommended_by: number | null;
  verification_code: string | null;
  created_by: number | null;
  client_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AwardInput {
  studentId: number;
  category: AwardCategory;
  title: string;
  description?: string | null;
  awardDate: string;
  issuedBy?: string | null;
  attachmentUrl?: string | null;
  certificateId?: number | null;
  status?: AwardStatus;
  clientId?: number | null;
}

export interface AwardFilters {
  organizationId?: number;
  studentId?: number;
  category?: AwardCategory;
  status?: AwardStatus;
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface StudentAchievementSummary {
  studentId: number;
  studentName: string;
  totalCertificates: number;
  totalAwards: number;
  certificatesByType: Record<string, number>;
  awardsByCategory: Record<string, number>;
  recentCertificates: Record<string, unknown>[];
  recentAwards: Record<string, unknown>[];
}

export interface VoiceEntry {
  id: number;
  organization_id: number;
  student_id: number | null;
  entity_type: string | null;
  entity_id: number | null;
  module_code: string;
  transcript: string;
  processed_json: string | null;
  audio_url: string | null;
  speech_engine: string | null;
  status: VoiceEntryStatus;
  created_by: number | null;
  client_id: number | null;
  created_at: string;
  modified_at: string;
}

export type VoiceEntryStatus = 'draft' | 'processed' | 'saved' | 'failed';

export interface VoiceEntryEdit {
  id: number;
  voice_entry_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  edited_by: number | null;
  edited_at: string;
}

export interface VoiceEntryInput {
  studentId?: number | null;
  entityType?: string | null;
  entityId?: number | null;
  moduleCode: string;
  transcript: string;
  processedJson?: Record<string, unknown> | null;
  audioUrl?: string | null;
  speechEngine?: string | null;
  status?: VoiceEntryStatus;
  clientId?: number | null;
}

export interface VoiceEntryFilters {
  organizationId?: number;
  studentId?: number;
  moduleCode?: string;
  status?: VoiceEntryStatus;
  speechEngine?: string;
  createdBy?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SyncPushItem {
  queueId?: number;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  entityId?: number;
  clientId?: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  organizationId: number;
  permissions: { key: string; scope: PermissionScope }[];
  linkedStudentIds: number[];
}

export interface LookupOption {
  value: string;
  label: string;
}

export type LookupCategory = 'class' | 'grade' | 'section' | 'status' | 'feeStatus';

export type LookupMap = Record<LookupCategory, LookupOption[]>;

export interface AttendanceFilters {
  organizationId?: number;
  date?: string;
  groupId?: number;
  studentId?: number;
  eventId?: number;
  contextType?: AttendanceContextType;
  periodNumber?: number;
  fromDate?: string;
  toDate?: string;
}

export interface EventFilters {
  organizationId?: number;
  groupId?: number;
  status?: EventStatus;
  studentId?: number;
  fromDate?: string;
  toDate?: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  linkedStudentId?: number;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
  linkedStudentId?: number | null;
}

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'multiselect'
  | 'boolean';

export interface CustomFieldOption {
  value: string;
  label: string;
}

export interface CustomFieldValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minDate?: string;
  maxDate?: string;
  options?: CustomFieldOption[];
}

export interface CustomFieldDefinition {
  id: number;
  organization_id: number;
  entity_type: string;
  field_name: string;
  field_label: string;
  field_type: CustomFieldType;
  is_required: number;
  default_value: string | null;
  validation_rules_json: string | null;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  client_id: number | null;
}

export interface CustomFieldValue {
  id: number;
  organization_id: number;
  field_definition_id: number;
  entity_type: string;
  entity_id: number;
  value_text: string | null;
  client_id: number | null;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  organization_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  changes_json: string | null;
  user_id: number | null;
  created_at: string;
}

export interface CustomFieldDefinitionInput {
  entityType?: string;
  fieldName?: string;
  fieldLabel: string;
  fieldType: CustomFieldType;
  isRequired?: boolean;
  defaultValue?: string;
  validationRules?: CustomFieldValidationRules;
  displayOrder?: number;
  isActive?: boolean;
  clientId?: number;
}

export interface CustomFieldValueInput {
  fieldDefinitionId?: number;
  fieldName?: string;
  value: string | string[] | boolean | number | null;
}

export interface CustomFieldFilters {
  organizationId?: number;
  entityType?: string;
  includeInactive?: boolean;
}

export interface ReportFilters {
  fromDate?: string;
  toDate?: string;
  groupId?: number;
  studentId?: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface ReportKpis {
  totalStudents: number;
  activeStudents: number;
  totalGroups: number;
  totalEvents: number;
  voiceEntries: number;
  certificates: number;
  awards: number;
}

export interface DashboardOverview {
  organizationId: number;
  scope: string;
  generatedAt: string;
  filters: ReportFilters;
  kpis: ReportKpis;
  trends: {
    students: TrendPoint[];
    voiceEntries: TrendPoint[];
    certificates: TrendPoint[];
    awards: TrendPoint[];
    events: TrendPoint[];
  };
  breakdowns: {
    studentsByStatus: Record<string, number>;
    studentsByClass: Record<string, number>;
    voiceByModule: Record<string, number>;
    certificatesByType: Record<string, number>;
    awardsByCategory: Record<string, number>;
    eventsByType: Record<string, number>;
  };
  recentActivity: ReportActivityItem[];
  quickActions: ReportQuickAction[];
}

export interface ReportActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  entityType?: string;
  entityId?: number;
  occurredAt: string;
}

export interface ReportQuickAction {
  label: string;
  route: string;
  icon: string;
}

export type ReportExportEntity =
  | 'students'
  | 'voice'
  | 'certificates'
  | 'awards'
  | 'events'
  | 'audit';

export interface ParentChildSummary {
  studentId: number;
  code: string;
  name: string;
  class: string;
  section: string | null;
  status: StudentStatus;
  relationshipType: ParentRelationshipType;
  isPrimaryContact: boolean;
}

export interface ParentDashboardData {
  childrenCount: number;
  selectedStudentId: number | null;
  children: ParentChildSummary[];
  upcomingEvents: unknown[];
  recentCertificates: unknown[];
  recentAwards: unknown[];
  recentVoiceEntries: unknown[];
  achievementSummary: {
    certificates: number;
    awards: number;
    voiceEntries: number;
    eventsParticipated: number;
  };
  parentAttendanceEnabled: boolean;
  attendanceComingSoon: boolean;
  attendanceSummary?: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    percentage: number;
  };
  recentAbsences?: unknown[];
  absenceAlertCount?: number;
}
