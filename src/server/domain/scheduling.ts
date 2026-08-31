import { ActorContext, Appointment, AppointmentStatus, DispatchAssignment, DispatchStatus, DomainResult, FleetDomainError, assertOrganization, audit } from './fleet';

const appointmentTransitions: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = {
  requested: ['scheduled', 'cancelled'], scheduled: ['confirmed', 'cancelled'], confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'], completed: [], cancelled: [], no_show: [],
};
const dispatchTransitions: Readonly<Record<DispatchStatus, readonly DispatchStatus[]>> = {
  unassigned: ['assigned', 'cancelled'], assigned: ['accepted', 'unassigned', 'cancelled'], accepted: ['en_route', 'unassigned', 'cancelled'],
  en_route: ['arrived', 'cancelled'], arrived: ['working', 'cancelled'], working: ['completed', 'cancelled'], completed: [], cancelled: [],
};

export interface CapacityWindow { technicianId: string; startsAt: string; endsAt: string; capacity: number; }

export function findScheduleConflicts(candidate: Appointment, existing: readonly Appointment[], capacities: readonly CapacityWindow[] = []): readonly string[] {
  const start = Date.parse(candidate.startsAt), end = Date.parse(candidate.endsAt);
  if (!(start < end)) throw new FleetDomainError('INVALID_APPOINTMENT_WINDOW', 'Appointment must end after it starts');
  const conflicts: string[] = [];
  for (const technicianId of candidate.technicianIds) {
    const overlapping = existing.filter((item) => item.organizationId === candidate.organizationId && item.id !== candidate.id &&
      item.status !== 'cancelled' && item.technicianIds.includes(technicianId) && Date.parse(item.startsAt) < end && Date.parse(item.endsAt) > start);
    const window = capacities.find((item) => item.technicianId === technicianId && Date.parse(item.startsAt) <= start && Date.parse(item.endsAt) >= end);
    if (!window || overlapping.length >= window.capacity) conflicts.push(technicianId);
  }
  return conflicts;
}

export function transitionAppointment(item: Appointment, to: AppointmentStatus, context: ActorContext): DomainResult<Appointment> {
  assertOrganization(context.organizationId, item.organizationId);
  if (!appointmentTransitions[item.status].includes(to)) throw new FleetDomainError('INVALID_APPOINTMENT_TRANSITION', `Cannot transition appointment from ${item.status} to ${to}`);
  const value = { ...item, status: to };
  return { value, events: [audit(context, 'appointment', item.id, `appointment.${to}`, { from: item.status, to })] };
}

export function assignDispatch(item: DispatchAssignment, technicianId: string, context: ActorContext): DomainResult<DispatchAssignment> {
  assertOrganization(context.organizationId, item.organizationId);
  if (!['unassigned', 'assigned', 'accepted'].includes(item.status)) throw new FleetDomainError('DISPATCH_NOT_ASSIGNABLE', 'Dispatch can no longer be assigned');
  const previousTechnicianId = item.technicianId;
  const value: DispatchAssignment = { ...item, technicianId, status: 'assigned', assignedAt: context.now };
  return { value, events: [audit(context, 'dispatch', item.id, previousTechnicianId ? 'dispatch.reassigned' : 'dispatch.assigned', { previousTechnicianId, technicianId })] };
}

export function transitionDispatch(item: DispatchAssignment, to: DispatchStatus, context: ActorContext): DomainResult<DispatchAssignment> {
  assertOrganization(context.organizationId, item.organizationId);
  if (!dispatchTransitions[item.status].includes(to)) throw new FleetDomainError('INVALID_DISPATCH_TRANSITION', `Cannot transition dispatch from ${item.status} to ${to}`);
  if (to !== 'unassigned' && to !== 'cancelled' && !item.technicianId) throw new FleetDomainError('TECHNICIAN_REQUIRED', 'Dispatch requires a technician');
  const value = { ...item, status: to, technicianId: to === 'unassigned' ? undefined : item.technicianId };
  return { value, events: [audit(context, 'dispatch', item.id, `dispatch.${to}`, { from: item.status, to })] };
}
