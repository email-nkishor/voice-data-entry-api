export type UserRole = 'admin' | 'admission_clerk' | 'teacher';

export type StudentStatus =
  | 'pending_approval'
  | 'active'
  | 'on_leave'
  | 'graduated'
  | 'inactive'
  | 'pending_docs'
  | 'new_admission';

export type FeeStatus = 'paid' | 'partial' | 'overdue' | 'not_applicable';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface StudentGroup {
  id: number;
  name: string;
  description: string | null;
  is_default: number;
  client_id: number | null;
  created_at: string;
}

export interface Student {
  id: number;
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
}

export interface LookupOption {
  value: string;
  label: string;
}

export type LookupCategory = 'class' | 'grade' | 'section' | 'status' | 'feeStatus';

export type LookupMap = Record<LookupCategory, LookupOption[]>;
