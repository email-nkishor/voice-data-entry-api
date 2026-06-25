import { getRepository } from '../db/database';
import {
  AttendanceRecord,
  AttendanceStatus,
  Award,
  Certificate,
  Event,
  Student,
  VoiceEntry,
} from '../types';
import { linkParentToStudent } from './user.service';
import { syncParentEntitiesFromUserLinks } from './parent-entity.service';

const SEED_MARKER = 'DEMO-SEED';

interface DemoStudentSeed {
  admissionNo: string;
  name: string;
  className: string;
  rollNo: string;
  section: string;
  groupName: string;
  mobile: string;
  parentName: string;
  parentMobile: string;
  feeStatus: Student['fee_status'];
}

const DEMO_STUDENTS: DemoStudentSeed[] = [
  {
    admissionNo: `${SEED_MARKER}-001`,
    name: 'Rahul Kumar',
    className: '10',
    rollNo: '001',
    section: 'A',
    groupName: 'MCA Batch 2026',
    mobile: '9876543210',
    parentName: 'Parent User',
    parentMobile: '9876543211',
    feeStatus: 'paid',
  },
  {
    admissionNo: `${SEED_MARKER}-002`,
    name: 'Priya Sharma',
    className: '10',
    rollNo: '002',
    section: 'A',
    groupName: 'MCA Batch 2026',
    mobile: '9876500002',
    parentName: 'Parent User',
    parentMobile: '9876543211',
    feeStatus: 'paid',
  },
  {
    admissionNo: `${SEED_MARKER}-003`,
    name: 'Arjun Mehta',
    className: '9',
    rollNo: '003',
    section: 'B',
    groupName: 'BCA Batch 2026',
    mobile: '9876500003',
    parentName: 'Raj Mehta',
    parentMobile: '9876500103',
    feeStatus: 'partial',
  },
  {
    admissionNo: `${SEED_MARKER}-004`,
    name: 'Sneha Reddy',
    className: '9',
    rollNo: '004',
    section: 'B',
    groupName: 'BCA Batch 2026',
    mobile: '9876500004',
    parentName: 'Lakshmi Reddy',
    parentMobile: '9876500104',
    feeStatus: 'paid',
  },
  {
    admissionNo: `${SEED_MARKER}-005`,
    name: 'Vikram Singh',
    className: '8',
    rollNo: '005',
    section: 'C',
    groupName: 'General Admission',
    mobile: '9876500005',
    parentName: 'Harpreet Singh',
    parentMobile: '9876500105',
    feeStatus: 'overdue',
  },
  {
    admissionNo: `${SEED_MARKER}-006`,
    name: 'Ananya Patel',
    className: '8',
    rollNo: '006',
    section: 'C',
    groupName: 'General Admission',
    mobile: '9876500006',
    parentName: 'Meera Patel',
    parentMobile: '9876500106',
    feeStatus: 'paid',
  },
];

function isoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function hasSeedData(): boolean {
  const repo = getRepository();
  return repo.listStudents().some((student) => student.admission_no?.startsWith(SEED_MARKER));
}

function upgradeLegacyDemoStudent(): void {
  const repo = getRepository();
  const legacy = repo.listStudents().find(
    (student) =>
      student.name === 'Demo Student' ||
      student.admission_no === 'ADM001' ||
      student.roll_no === '001'
  );
  if (!legacy || legacy.admission_no?.startsWith(SEED_MARKER)) {
    return;
  }
  const group = repo.listGroups().find((g) => g.name === 'MCA Batch 2026') ?? repo.listGroups()[0];
  repo.updateStudentRecord({
    ...legacy,
    name: 'Rahul Kumar',
    admission_no: `${SEED_MARKER}-001`,
    class: '10',
    section: 'A',
    parent_name: 'Parent User',
    parent_mobile: '9876543211',
    group_id: group?.id ?? legacy.group_id,
    updated_at: new Date().toISOString(),
  });
}

function ensureDemoStudent(seed: DemoStudentSeed): Student {
  const repo = getRepository();
  const existing = repo
    .listStudents()
    .find((student) => student.admission_no === seed.admissionNo);
  if (existing) {
    return existing;
  }

  const group =
    repo.listGroups().find((g) => g.name === seed.groupName) ??
    repo.listGroups().find((g) => g.is_default) ??
    repo.listGroups()[0];
  const now = new Date().toISOString();
  const id = repo.nextId('students');
  const student: Student = {
    id,
    organization_id: 1,
    name: seed.name,
    class: seed.className,
    roll_no: seed.rollNo,
    mobile: seed.mobile,
    address: 'Noida, Uttar Pradesh',
    admission_no: seed.admissionNo,
    parent_name: seed.parentName,
    parent_mobile: seed.parentMobile,
    academic_year: '2025-26',
    section: seed.section,
    status: 'active',
    fee_status: seed.feeStatus,
    group_id: group?.id ?? null,
    custom_data: null,
    client_id: null,
    created_at: now,
    updated_at: now,
  };
  repo.insertStudent(student);
  if (group) {
    repo.assignStudentToGroup({
      id: repo.nextId('groupStudents'),
      organization_id: 1,
      group_id: group.id,
      student_id: id,
      assigned_at: now,
      assigned_by: 1,
    });
  }
  return student;
}

function seedAttendanceForStudents(students: Student[]): void {
  const repo = getRepository();
  const clerkId = repo.findUserByEmail('clerk@institute.local')?.id ?? 1;
  const statuses: AttendanceStatus[] = ['present', 'present', 'present', 'absent', 'late', 'excused'];

  for (const student of students.slice(0, 4)) {
    for (let daysAgo = 1; daysAgo <= 20; daysAgo++) {
      const date = isoDate(daysAgo);
      const day = new Date(date).getDay();
      if (day === 0 || day === 6) {
        continue;
      }
      const exists = repo.listAttendance({
        organizationId: 1,
        studentId: student.id,
        date,
      });
      if (exists.length > 0) {
        continue;
      }
      const status = statuses[daysAgo % statuses.length];
      const now = new Date().toISOString();
      repo.upsertAttendance({
        id: repo.nextId('attendanceRecords'),
        organization_id: 1,
        student_id: student.id,
        group_id: student.group_id,
        event_id: null,
        attendance_date: date,
        context_type: 'daily',
        period_number: null,
        status,
        remarks: status === 'absent' ? 'Uninformed absence' : null,
        marked_by: clerkId,
        client_id: null,
        created_at: now,
        updated_at: now,
      } as AttendanceRecord);
    }
  }
}

function seedEvents(students: Student[]): Event[] {
  const repo = getRepository();
  const mcaGroup = repo.listGroups().find((g) => g.name === 'MCA Batch 2026');
  const now = new Date().toISOString();
  const eventsData: Array<{
    title: string;
    description: string;
    eventType: 'academic' | 'sports' | 'cultural' | 'other';
    startDate: string;
    endDate: string;
    location: string;
    groupId: number | null;
  }> = [
    {
      title: 'Annual Day 2026',
      description: 'School annual cultural program',
      eventType: 'cultural',
      startDate: isoDate(-14),
      endDate: isoDate(-14),
      location: 'Main Auditorium',
      groupId: mcaGroup?.id ?? null,
    },
    {
      title: 'Science Fair',
      description: 'Inter-class science exhibition',
      eventType: 'academic',
      startDate: isoDate(-7),
      endDate: isoDate(-7),
      location: 'Science Block',
      groupId: mcaGroup?.id ?? null,
    },
    {
      title: 'Parent-Teacher Meeting',
      description: 'Term review with parents',
      eventType: 'other',
      startDate: isoDate(7),
      endDate: isoDate(7),
      location: 'Classrooms',
      groupId: null,
    },
  ];

  const created: Event[] = [];
  for (const item of eventsData) {
    const existing = repo.listEvents({ organizationId: 1 }).find((e) => e.title === item.title);
    if (existing) {
      created.push(existing);
      continue;
    }
    const id = repo.nextId('events');
    const event: Event = {
      id,
      organization_id: 1,
      title: item.title,
      description: item.description,
      event_type: item.eventType,
      start_date: item.startDate,
      end_date: item.endDate,
      location: item.location,
      group_id: item.groupId,
      created_by: 1,
      status: 'published',
      client_id: null,
      created_at: now,
      updated_at: now,
    };
    repo.insertEvent(event);
    created.push(event);

    for (const student of students.slice(0, 3)) {
      repo.addEventParticipant({
        id: repo.nextId('eventParticipants'),
        event_id: id,
        student_id: student.id,
        registration_status: 'registered',
      });
    }
  }
  return created;
}

function seedCertificatesAndAwards(primaryStudent: Student): void {
  const repo = getRepository();
  const template = repo.listCertificateTemplates(1)[0];
  const now = new Date().toISOString();

  const certDefs = [
    {
      title: 'Certificate of Merit — Mathematics',
      certificateType: 'merit' as const,
      issueDate: isoDate(30),
    },
    {
      title: 'Certificate of Participation — Science Fair',
      certificateType: 'participation' as const,
      issueDate: isoDate(7),
    },
  ];

  for (const [index, cert] of certDefs.entries()) {
    const exists = repo
      .listCertificates({ organizationId: 1, studentId: primaryStudent.id })
      .some((c) => c.title === cert.title);
    if (exists) {
      continue;
    }
    const id = repo.nextId('certificates');
    const record: Certificate = {
      id,
      organization_id: 1,
      student_id: primaryStudent.id,
      template_id: template?.id ?? null,
      certificate_number: `CERT-1-2026-${String(id).padStart(6, '0')}`,
      certificate_type: cert.certificateType,
      title: cert.title,
      description: `Awarded to ${primaryStudent.name}`,
      certificate_name: cert.title,
      award_type: cert.certificateType,
      issue_date: cert.issueDate,
      issued_by: 'Institute Admin',
      attachment_url: null,
      verification_code: `CERT-${SEED_MARKER}-${index + 1}`,
      status: 'issued',
      revoked_at: null,
      revoked_by: null,
      revoke_reason: null,
      created_by: 1,
      client_id: null,
      created_at: now,
      updated_at: now,
    };
    repo.insertCertificate(record);
  }

  const awardDefs = [
    { title: 'Best Attendance — Term 1', category: 'attendance' as const, daysAgo: 20 },
    { title: 'Science Quiz Winner', category: 'academic' as const, daysAgo: 10 },
    { title: 'Inter-house Sports Silver', category: 'sports' as const, daysAgo: 5 },
  ];

  for (const [index, award] of awardDefs.entries()) {
    const exists = repo
      .listAwards({ organizationId: 1, studentId: primaryStudent.id })
      .some((a) => a.title === award.title);
    if (exists) {
      continue;
    }
    const id = repo.nextId('awards');
    const record: Award = {
      id,
      organization_id: 1,
      student_id: primaryStudent.id,
      category: award.category,
      title: award.title,
      description: `Demo award for ${primaryStudent.name}`,
      award_date: isoDate(award.daysAgo),
      issued_by: 'Institute Admin',
      attachment_url: null,
      certificate_id: null,
      status: 'issued',
      recommended_by: null,
      verification_code: `AWD-${SEED_MARKER}-${index + 1}`,
      created_by: 1,
      client_id: null,
      created_at: now,
      updated_at: now,
    };
    repo.insertAward(record);
  }
}

function seedVoiceEntries(primaryStudent: Student): void {
  const repo = getRepository();
  const clerkId = repo.findUserByEmail('clerk@institute.local')?.id ?? 1;
  const now = new Date().toISOString();
  const entries = [
    {
      moduleCode: 'student',
      transcript: 'Rahul Kumar class 10 roll 001 mobile 9876543210 address Noida',
      status: 'saved' as const,
    },
    {
      moduleCode: 'attendance',
      transcript: 'Mark Rahul Kumar present for today daily attendance',
      status: 'processed' as const,
    },
  ];

  for (const entry of entries) {
    const exists = repo
      .listVoiceEntries({ organizationId: 1, studentId: primaryStudent.id, moduleCode: entry.moduleCode })
      .some((v) => v.transcript === entry.transcript);
    if (exists) {
      continue;
    }
    const id = repo.nextId('voiceEntries');
    const record: VoiceEntry = {
      id,
      organization_id: 1,
      student_id: primaryStudent.id,
      entity_type: 'student',
      entity_id: primaryStudent.id,
      module_code: entry.moduleCode,
      transcript: entry.transcript,
      processed_json: JSON.stringify({ studentName: primaryStudent.name }),
      audio_url: null,
      speech_engine: 'web-speech',
      status: entry.status,
      created_by: clerkId,
      client_id: null,
      created_at: now,
      modified_at: now,
    };
    repo.insertVoiceEntry(record);
  }
}

function linkParentToDemoChildren(students: Student[]): void {
  const repo = getRepository();
  const parent = repo.findUserByEmail('parent@institute.local');
  const studentUser = repo.findUserByEmail('student@institute.local');
  if (!parent) {
    return;
  }

  const linked = students.filter((s) =>
    [`${SEED_MARKER}-001`, `${SEED_MARKER}-002`].includes(s.admission_no ?? '')
  );

  for (const [index, student] of linked.entries()) {
    linkParentToStudent(parent.id, student.id, 'guardian');
    if (index === 0) {
      const updatedParent = repo.findUserById(parent.id);
      if (updatedParent) {
        repo.updateUser({ ...updatedParent, linked_student_id: student.id });
      }
    }
  }

  const primary = linked[0] ?? students[0];
  if (studentUser && primary) {
    repo.updateUser({
      ...studentUser,
      linked_student_id: primary.id,
    });
  }
  syncParentEntitiesFromUserLinks();
}

/** Idempotent rich demo dataset for local development and QA. */
export function seedRichDemoData(): void {
  upgradeLegacyDemoStudent();
  if (hasSeedData() && getRepository().listAttendance().length > 10) {
    const students = getRepository()
      .listStudents()
      .filter((s) => s.admission_no?.startsWith(SEED_MARKER));
    linkParentToDemoChildren(students);
    return;
  }

  const students = DEMO_STUDENTS.map((seed) => ensureDemoStudent(seed));
  seedAttendanceForStudents(students);
  seedEvents(students);
  seedCertificatesAndAwards(students[0]);
  seedVoiceEntries(students[0]);
  linkParentToDemoChildren(students);
}
