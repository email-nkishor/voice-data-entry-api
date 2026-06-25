import { getRepository } from '../db/database';
import { AuthUser } from '../types';
import { Event, EventParticipant } from '../types';
import { canAccessStudent, getAccessibleGroupIds } from './permission.service';

export interface EventInput {
  title: string;
  description?: string;
  eventType?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  groupId?: number;
  status?: string;
  clientId?: number;
}

export function listEvents(user: AuthUser, filters?: { groupId?: number; status?: string }) {
  const repo = getRepository();
  const groupIds = getAccessibleGroupIds(user);

  let events = repo.listEvents({
    organizationId: user.organizationId,
    groupId: filters?.groupId,
    status: filters?.status as never,
  });

  if (groupIds !== 'all') {
    events = events.filter(
      (e) => !e.group_id || groupIds.includes(e.group_id)
    );
  }

  if (user.role === 'student') {
    const studentId = user.linkedStudentIds[0];
    if (!studentId) {
      return [];
    }
    const participantEventIds = new Set<number>();
    for (const event of events) {
      const participants = repo.listEventParticipants(event.id);
      if (participants.some((p) => p.student_id === studentId)) {
        participantEventIds.add(event.id);
      }
    }
    events = events.filter((e) => participantEventIds.has(e.id));
  }

  if (user.role === 'parent') {
    const childIds = new Set(user.linkedStudentIds);
    events = events.filter((event) => {
      const participants = repo.listEventParticipants(event.id);
      return participants.some((p) => childIds.has(p.student_id));
    });
  }

  return events.map(eventToApi);
}

export function getEventById(id: number, user: AuthUser) {
  const repo = getRepository();
  const event = repo.getEventById(id);
  if (!event) {
    return undefined;
  }
  return eventToApi(event);
}

export function createEvent(input: EventInput, userId: number) {
  const repo = getRepository();
  const now = new Date().toISOString();
  const id = repo.nextId('events');
  const event = {
    id,
    organization_id: 1,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    event_type: (input.eventType ?? 'other') as never,
    start_date: input.startDate,
    end_date: input.endDate ?? null,
    location: input.location?.trim() ?? null,
    group_id: input.groupId ?? null,
    created_by: userId,
    status: (input.status ?? 'draft') as never,
    client_id: input.clientId ?? null,
    created_at: now,
    updated_at: now,
  };
  repo.insertEvent(event);
  return eventToApi(event);
}

export function updateEvent(id: number, input: Partial<EventInput>) {
  const repo = getRepository();
  const existing = repo.getEventById(id);
  if (!existing) {
    return undefined;
  }
  const updated = {
    ...existing,
    title: input.title?.trim() ?? existing.title,
    description: input.description !== undefined ? (input.description?.trim() ?? null) : existing.description,
    event_type: (input.eventType ?? existing.event_type) as never,
    start_date: input.startDate ?? existing.start_date,
    end_date: input.endDate !== undefined ? (input.endDate ?? null) : existing.end_date,
    location: input.location !== undefined ? (input.location?.trim() ?? null) : existing.location,
    group_id: input.groupId !== undefined ? (input.groupId ?? null) : existing.group_id,
    status: (input.status ?? existing.status) as never,
    updated_at: new Date().toISOString(),
  };
  repo.updateEvent(updated);
  return eventToApi(updated);
}

export function deleteEvent(id: number): boolean {
  return getRepository().deleteEvent(id);
}

export function addEventParticipants(eventId: number, studentIds: number[]) {
  const repo = getRepository();
  for (const studentId of studentIds) {
    const existing = repo.listEventParticipants(eventId);
    if (existing.some((p) => p.student_id === studentId)) {
      continue;
    }
    repo.addEventParticipant({
      id: repo.nextId('eventParticipants'),
      event_id: eventId,
      student_id: studentId,
      registration_status: 'registered',
    });
  }
  return repo.listEventParticipants(eventId).map(participantToApi);
}

export function listEventParticipants(eventId: number) {
  return getRepository()
    .listEventParticipants(eventId)
    .map(participantToApi);
}

function eventToApi(event: Event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventType: event.event_type,
    startDate: event.start_date,
    endDate: event.end_date,
    location: event.location,
    groupId: event.group_id,
    createdBy: event.created_by,
    status: event.status,
    clientId: event.client_id,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  };
}

function participantToApi(p: EventParticipant) {
  return {
    id: p.id,
    eventId: p.event_id,
    studentId: p.student_id,
    registrationStatus: p.registration_status,
  };
}
