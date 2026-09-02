import { listMaintenance } from './operationsPersistence.js';

export type MaintenanceAttentionState = 'overdue' | 'due' | 'due_soon' | 'upcoming' | 'unknown';

export interface MaintenanceThresholds {
  dueMiles: number;
  dueEngineHours: number;
  dueDays: number;
  dueSoonMiles: number;
  dueSoonEngineHours: number;
  dueSoonDays: number;
}

export const DEFAULT_MAINTENANCE_THRESHOLDS: MaintenanceThresholds = {
  dueMiles: 100,
  dueEngineHours: 5,
  dueDays: 3,
  dueSoonMiles: 500,
  dueSoonEngineHours: 25,
  dueSoonDays: 30,
};

const finiteDifference = (next: number | null, current: number | null) =>
  next == null || current == null ? null : next - current;

export function classifyMaintenance(
  nextDueAt: Date | null,
  nextDueMileage: number | null,
  mileage: number | null,
  nextDueEngineHours: number | null,
  engineHours: number | null,
  now = new Date(),
  thresholds = DEFAULT_MAINTENANCE_THRESHOLDS,
): MaintenanceAttentionState {
  const miles = finiteDifference(nextDueMileage, mileage);
  const hours = finiteDifference(nextDueEngineHours, engineHours);
  const days = nextDueAt == null ? null : (nextDueAt.getTime() - now.getTime()) / 86_400_000;
  if (miles == null && hours == null && days == null) return 'unknown';
  if ((miles != null && miles < 0) || (hours != null && hours < 0) || (days != null && days < 0)) return 'overdue';
  if ((miles != null && miles <= thresholds.dueMiles) || (hours != null && hours <= thresholds.dueEngineHours) || (days != null && days <= thresholds.dueDays)) return 'due';
  if ((miles != null && miles <= thresholds.dueSoonMiles) || (hours != null && hours <= thresholds.dueSoonEngineHours) || (days != null && days <= thresholds.dueSoonDays)) return 'due_soon';
  return 'upcoming';
}

const priority: Record<MaintenanceAttentionState, number> = { overdue: 5, due: 4, due_soon: 3, upcoming: 2, unknown: 1 };
const urgency = (value: number | null) => value == null ? Number.MAX_SAFE_INTEGER : value;

export class MaintenanceIntelligenceService {
  async attention(organizationId: string, now = new Date()) {
    const rows = await listMaintenance(organizationId);
    const items = rows.filter((row) => row.active).map((row) => {
      const status = classifyMaintenance(row.nextDueAt, row.nextDueMileage, row.mileage, row.nextDueEngineHours, row.engineHours, now);
      const milesUntilDue = finiteDifference(row.nextDueMileage, row.mileage);
      const engineHoursUntilDue = finiteDifference(row.nextDueEngineHours, row.engineHours);
      const daysUntilDue = row.nextDueAt == null ? null : Math.ceil((row.nextDueAt.getTime() - now.getTime()) / 86_400_000);
      const triggeredBy = [
        daysUntilDue != null && daysUntilDue <= DEFAULT_MAINTENANCE_THRESHOLDS.dueSoonDays ? 'date' : null,
        milesUntilDue != null && milesUntilDue <= DEFAULT_MAINTENANCE_THRESHOLDS.dueSoonMiles ? 'mileage' : null,
        engineHoursUntilDue != null && engineHoursUntilDue <= DEFAULT_MAINTENANCE_THRESHOLDS.dueSoonEngineHours ? 'engine_hours' : null,
      ].filter((value): value is string => Boolean(value));
      const reason = status === 'overdue' ? 'Service interval has been exceeded'
        : status === 'due' ? 'Service is due now'
        : status === 'due_soon' ? 'Service is approaching its interval'
        : status === 'upcoming' ? 'Service is scheduled for a future interval'
        : 'Insufficient mileage, date, or engine-hour data';
      return { ...row, status, milesUntilDue, engineHoursUntilDue, daysUntilDue, triggeredBy, reason };
    }).sort((a, b) =>
      priority[b.status] - priority[a.status]
      || Math.min(urgency(a.daysUntilDue), urgency(a.milesUntilDue), urgency(a.engineHoursUntilDue))
        - Math.min(urgency(b.daysUntilDue), urgency(b.milesUntilDue), urgency(b.engineHoursUntilDue))
      || a.unitNumber.localeCompare(b.unitNumber)
      || a.serviceCode.localeCompare(b.serviceCode));

    const attention = items.filter((item) => ['overdue','due','due_soon'].includes(item.status));
    return {
      generatedAt: now.toISOString(),
      items,
      attention,
      summary: {
        totalActive: items.length,
        needsAttention: attention.length,
        overdue: items.filter((item) => item.status === 'overdue').length,
        due: items.filter((item) => item.status === 'due').length,
        dueSoon: items.filter((item) => item.status === 'due_soon').length,
        upcoming: items.filter((item) => item.status === 'upcoming').length,
        unknown: items.filter((item) => item.status === 'unknown').length,
      },
    };
  }
}

export const maintenanceIntelligenceService = new MaintenanceIntelligenceService();
