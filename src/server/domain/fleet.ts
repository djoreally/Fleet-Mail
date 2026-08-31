export type OrganizationId = string;
export type EntityId = string;
export type ISODateTime = string;

export interface OrganizationScoped {
  organizationId: OrganizationId;
}

export interface AuditEvent extends OrganizationScoped {
  eventId: EntityId;
  entityType: 'intake' | 'vehicle' | 'work_order' | 'maintenance' | 'appointment' | 'dispatch' | 'invoice' | 'document';
  entityId: EntityId;
  action: string;
  actorId: EntityId;
  occurredAt: ISODateTime;
  changes?: Readonly<Record<string, unknown>>;
}

export interface ActorContext extends OrganizationScoped {
  actorId: EntityId;
  now: ISODateTime;
  eventId: EntityId;
}

export interface DomainResult<T> {
  value: T;
  events: readonly AuditEvent[];
}

export class FleetDomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'FleetDomainError';
  }
}

export function assertOrganization(expected: OrganizationId, actual: OrganizationId): void {
  if (!expected || expected !== actual) {
    throw new FleetDomainError('ORGANIZATION_SCOPE_VIOLATION', 'Resource does not belong to the active organization');
  }
}

export function audit(
  context: ActorContext,
  entityType: AuditEvent['entityType'],
  entityId: EntityId,
  action: string,
  changes?: Readonly<Record<string, unknown>>,
): AuditEvent {
  return { ...context, entityType, entityId, action, occurredAt: context.now, changes };
}

export interface Vehicle extends OrganizationScoped {
  id: EntityId;
  fleetCustomerId: EntityId;
  vin?: string;
  unitNumber?: string;
  plate?: string;
  year?: number;
  make?: string;
  model?: string;
  odometer?: number;
  active: boolean;
}

export type WorkOrderStatus =
  | 'intake'
  | 'inspection_pending'
  | 'inspection_complete'
  | 'authorization_pending'
  | 'authorized'
  | 'service_in_progress'
  | 'completed'
  | 'cancelled';

export interface WorkOrderLine {
  id: EntityId;
  description: string;
  kind: 'labor' | 'part' | 'fee';
  quantity: number;
  unitPriceCents: number;
  authorized: boolean;
}

export interface WorkOrder extends OrganizationScoped {
  id: EntityId;
  fleetCustomerId: EntityId;
  vehicleId: EntityId;
  status: WorkOrderStatus;
  inspectionId?: EntityId;
  authorizationId?: EntityId;
  purchaseOrderNumber?: string;
  lines: readonly WorkOrderLine[];
  completedAt?: ISODateTime;
}

export type AppointmentStatus = 'requested' | 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export interface Appointment extends OrganizationScoped {
  id: EntityId;
  workOrderId: EntityId;
  vehicleId: EntityId;
  locationId: EntityId;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  status: AppointmentStatus;
  technicianIds: readonly EntityId[];
  recurrenceRule?: string;
}

export type DispatchStatus = 'unassigned' | 'assigned' | 'accepted' | 'en_route' | 'arrived' | 'working' | 'completed' | 'cancelled';
export interface DispatchAssignment extends OrganizationScoped {
  id: EntityId;
  appointmentId: EntityId;
  technicianId?: EntityId;
  status: DispatchStatus;
  assignedAt?: ISODateTime;
}

export interface PartRequirement extends OrganizationScoped {
  id: EntityId;
  workOrderId: EntityId;
  partNumber: string;
  description: string;
  quantity: number;
  status: 'required' | 'ordered' | 'received' | 'installed' | 'cancelled';
}

export interface FleetDocument extends OrganizationScoped {
  id: EntityId;
  entityType: 'vehicle' | 'work_order' | 'inspection' | 'invoice';
  entityId: EntityId;
  kind: 'photo' | 'inspection' | 'receipt' | 'authorization' | 'other';
  storageKey: string;
}

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
export interface InvoiceLine {
  workOrderLineId: EntityId;
  description: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}
export interface Invoice extends OrganizationScoped {
  id: EntityId;
  fleetCustomerId: EntityId;
  workOrderId: EntityId;
  status: InvoiceStatus;
  lines: readonly InvoiceLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  purchaseOrderNumber?: string;
}

export interface MaintenancePlan extends OrganizationScoped {
  id: EntityId;
  vehicleId: EntityId;
  serviceCode: string;
  intervalMiles?: number;
  intervalDays?: number;
  lastServiceMileage?: number;
  lastServiceAt?: ISODateTime;
  nextDueMileage?: number;
  nextDueAt?: ISODateTime;
  active: boolean;
}

export type MaintenanceDueStatus = 'not_due' | 'due_soon' | 'overdue' | 'unknown';
