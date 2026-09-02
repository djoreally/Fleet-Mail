import { listMaintenance } from './operationsPersistence.js';

export type MaintenanceAttentionState = 'overdue' | 'due' | 'due_soon' | 'upcoming' | 'unknown';

function classify(nextDueAt: Date | null, nextDueMileage: number | null, mileage: number | null, nextDueEngineHours: number | null, engineHours: number | null, now = new Date()): MaintenanceAttentionState {
  const miles = nextDueMileage == null || mileage == null ? null : nextDueMileage - mileage;
  const hours = nextDueEngineHours == null || engineHours == null ? null : nextDueEngineHours - engineHours;
  const days = nextDueAt == null ? null : (nextDueAt.getTime() - now.getTime()) / 86_400_000;
  if (miles == null && hours == null && days == null) return 'unknown';
  if ((miles != null && miles < 0) || (hours != null && hours < 0) || (days != null && days < 0)) return 'overdue';
  if ((miles != null && miles <= 100) || (hours != null && hours <= 5) || (days != null && days <= 3)) return 'due';
  if ((miles != null && miles <= 500) || (hours != null && hours <= 25) || (days != null && days <= 30)) return 'due_soon';
  return 'upcoming';
}

const priority: Record<MaintenanceAttentionState, number> = { overdue: 5, due: 4, due_soon: 3, upcoming: 2, unknown: 1 };

export class MaintenanceIntelligenceService {
  async attention(organizationId: string) {
    const rows = await listMaintenance(organizationId);
    const items = rows.filter((row) => row.active).map((row) => {
      const status = classify(row.nextDueAt, row.nextDueMileage, row.mileage, row.nextDueEngineHours, row.engineHours);
      const milesUntilDue = row.nextDueMileage == null || row.mileage == null ? null : row.nextDueMileage - row.mileage;
      const engineHoursUntilDue = row.nextDueEngineHours == null || row.engineHours == null ? null : row.nextDueEngineHours - row.engineHours;
      const daysUntilDue = row.nextDueAt == null ? null : Math.ceil((row.nextDueAt.getTime() - Date.now()) / 86_400_000);
      const reason = status === 'overdue' ? 'Service interval has been exceeded'
        : status === 'due' ? 'Service is due now'
        : status === 'due_soon' ? 'Service is approaching its interval'
        : status === 'upcoming' ? 'Service is scheduled for a future interval'
        : 'Insufficient mileage, date, or engine-hour data';
      return { ...row, status, milesUntilDue, engineHoursUntilDue, daysUntilDue, reason };
    }).sort((a, b) => priority[b.status] - priority[a.status] || (a.daysUntilDue ?? Number.MAX_SAFE_INTEGER) - (b.daysUntilDue ?? Number.MAX_SAFE_INTEGER));

    return {
      items,
      attention: items.filter((item) => ['overdue','due','due_soon'].includes(item.status)),
      summary: {
        totalActive: items.length,
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
