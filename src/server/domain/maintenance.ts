import { MaintenanceDueStatus, MaintenancePlan, Vehicle } from './fleet';

export function maintenanceDueStatus(plan: MaintenancePlan, vehicle: Vehicle, now: string, soonMiles = 500, soonDays = 14): MaintenanceDueStatus {
  if (!plan.active) return 'not_due';
  const mileageRemaining = plan.nextDueMileage == null || vehicle.odometer == null ? undefined : plan.nextDueMileage - vehicle.odometer;
  const daysRemaining = plan.nextDueAt == null ? undefined : (Date.parse(plan.nextDueAt) - Date.parse(now)) / 86_400_000;
  if (mileageRemaining == null && daysRemaining == null) return 'unknown';
  if ((mileageRemaining != null && mileageRemaining <= 0) || (daysRemaining != null && daysRemaining <= 0)) return 'overdue';
  if ((mileageRemaining != null && mileageRemaining <= soonMiles) || (daysRemaining != null && daysRemaining <= soonDays)) return 'due_soon';
  return 'not_due';
}

export function advanceMaintenancePlan(plan: MaintenancePlan, completedAt: string, odometer?: number): MaintenancePlan {
  const nextDueAt = plan.intervalDays ? new Date(Date.parse(completedAt) + plan.intervalDays * 86_400_000).toISOString() : undefined;
  const nextDueMileage = plan.intervalMiles && odometer != null ? odometer + plan.intervalMiles : undefined;
  return { ...plan, lastServiceAt: completedAt, lastServiceMileage: odometer, nextDueAt, nextDueMileage };
}

export function recurringAppointmentDates(firstStart: string, intervalDays: number, count: number): readonly string[] {
  if (!Number.isInteger(intervalDays) || intervalDays < 1 || !Number.isInteger(count) || count < 0) throw new RangeError('Invalid recurrence');
  return Array.from({ length: count }, (_, index) => new Date(Date.parse(firstStart) + index * intervalDays * 86_400_000).toISOString());
}
