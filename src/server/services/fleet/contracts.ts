import { Appointment, DispatchAssignment, FleetDocument, Invoice, MaintenancePlan, OrganizationId, PartRequirement, Vehicle, WorkOrder } from '../../domain/fleet';

export interface ScopedRepository<T extends { id: string; organizationId: OrganizationId }> {
  findById(organizationId: OrganizationId, id: string): Promise<T | null>;
  save(organizationId: OrganizationId, value: T): Promise<T>;
}

export interface FleetRepositories {
  vehicles: ScopedRepository<Vehicle> & { findCandidates(organizationId: OrganizationId, hints: VehicleHints): Promise<readonly Vehicle[]> };
  workOrders: ScopedRepository<WorkOrder>;
  maintenancePlans: ScopedRepository<MaintenancePlan>;
  appointments: ScopedRepository<Appointment>;
  dispatchAssignments: ScopedRepository<DispatchAssignment>;
  parts: ScopedRepository<PartRequirement>;
  invoices: ScopedRepository<Invoice>;
  documents: ScopedRepository<FleetDocument>;
}

export interface VehicleHints { vin?: string; unitNumber?: string; plate?: string; fleetCustomerId?: string; }
export interface VehicleMatch { vehicle: Vehicle; confidence: number; reasons: readonly string[]; }

export function rankVehicleMatches(hints: VehicleHints, candidates: readonly Vehicle[]): readonly VehicleMatch[] {
  const normalize = (value?: string) => value?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return candidates.map((vehicle) => {
    let confidence = 0; const reasons: string[] = [];
    if (hints.fleetCustomerId && hints.fleetCustomerId === vehicle.fleetCustomerId) { confidence += 0.1; reasons.push('fleet_customer'); }
    if (hints.vin && normalize(hints.vin) === normalize(vehicle.vin)) { confidence += 0.7; reasons.push('vin'); }
    if (hints.unitNumber && normalize(hints.unitNumber) === normalize(vehicle.unitNumber)) { confidence += 0.5; reasons.push('unit_number'); }
    if (hints.plate && normalize(hints.plate) === normalize(vehicle.plate)) { confidence += 0.4; reasons.push('plate'); }
    return { vehicle, confidence: Math.min(confidence, 1), reasons };
  }).filter((match) => match.confidence > 0).sort((a, b) => b.confidence - a.confidence);
}

export interface EmailFleetIntake {
  organizationId: OrganizationId;
  sourceMessageId: string;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string;
  hints: VehicleHints;
  requestedServices: readonly string[];
  urgency: 'routine' | 'urgent' | 'vehicle_down';
}

export interface IntakeDecision {
  organizationId: OrganizationId;
  sourceMessageId: string;
  vehicleMatch?: VehicleMatch;
  requiresReview: boolean;
  reason?: 'no_match' | 'ambiguous_match' | 'low_confidence';
}

export function decideIntakeMatch(intake: EmailFleetIntake, matches: readonly VehicleMatch[]): IntakeDecision {
  const [best, second] = matches;
  if (!best) return { organizationId: intake.organizationId, sourceMessageId: intake.sourceMessageId, requiresReview: true, reason: 'no_match' };
  if (best.vehicle.organizationId !== intake.organizationId) throw new Error('Organization scope violation in vehicle match');
  if (best.confidence < 0.5) return { organizationId: intake.organizationId, sourceMessageId: intake.sourceMessageId, vehicleMatch: best, requiresReview: true, reason: 'low_confidence' };
  if (second && best.confidence - second.confidence < 0.2) return { organizationId: intake.organizationId, sourceMessageId: intake.sourceMessageId, vehicleMatch: best, requiresReview: true, reason: 'ambiguous_match' };
  return { organizationId: intake.organizationId, sourceMessageId: intake.sourceMessageId, vehicleMatch: best, requiresReview: false };
}
