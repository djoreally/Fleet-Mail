import { serverConfig } from '../config.js';

type JsonRecord = Record<string, unknown>;

export class FleetOperationsError extends Error {
  constructor(message: string, readonly status = 500) { super(message); }
}

const allowedDispatchStatuses = new Set(['assigned', 'accepted', 'en_route', 'arrived', 'working', 'completed', 'cancelled']);
const allowedAppointmentStatuses = new Set(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']);

function cleanId(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new FleetOperationsError(`${name} is invalid`, 400);
  return value;
}

function isoDate(value: unknown, name: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new FleetOperationsError(`${name} must be an ISO date`, 400);
  return new Date(value).toISOString();
}

export class ScheduleDispatchService {
  constructor(private readonly dataApiUrl = serverConfig.neonDataApiUrl) {}

  private async request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
    if (!token) throw new FleetOperationsError('Authentication is required', 401);
    const response = await fetch(`${this.dataApiUrl}/${path}`, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Prefer: 'return=representation', ...init.headers },
    });
    const body = await response.text();
    if (!response.ok) {
      let message = body || `Database request failed (${response.status})`;
      try { const parsed = JSON.parse(body); message = parsed.message || parsed.error || message; } catch { /* text response */ }
      throw new FleetOperationsError(message, response.status);
    }
    return (body ? JSON.parse(body) : null) as T;
  }

  private org(value: unknown) { return cleanId(value, 'organizationId'); }
  private token(authorization?: string) { return authorization?.replace(/^Bearer\s+/i, '') || ''; }

  async listAppointments(organizationId: unknown, authorization?: string, from?: unknown, to?: unknown) {
    const org = this.org(organizationId); const token = this.token(authorization);
    const query = new URLSearchParams({ select: '*', organization_id: `eq.${org}`, order: 'starts_at.asc', limit: '200' });
    if (from) query.set('starts_at', `gte.${isoDate(from, 'from')}`);
    if (to) query.append('starts_at', `lt.${isoDate(to, 'to')}`);
    return this.request<JsonRecord[]>(token, `appointments?${query}`);
  }

  async createAppointment(organizationId: unknown, authorization: string | undefined, input: JsonRecord) {
    const org = this.org(organizationId); const startsAt = isoDate(input.startsAt, 'startsAt'); const endsAt = isoDate(input.endsAt, 'endsAt');
    if (endsAt <= startsAt) throw new FleetOperationsError('endsAt must be after startsAt', 400);
    const status = String(input.status || 'scheduled');
    if (!allowedAppointmentStatuses.has(status)) throw new FleetOperationsError('Appointment status is invalid', 400);
    const payload = { organization_id: org, work_order_id: input.workOrderId || null, customer_id: input.customerId || null, vehicle_id: input.vehicleId || null, location_id: input.locationId || null, starts_at: startsAt, ends_at: endsAt, status, notes: input.notes || null };
    return this.request<JsonRecord[]>(this.token(authorization), 'appointments', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateAppointment(organizationId: unknown, authorization: string | undefined, idValue: unknown, input: JsonRecord) {
    const org = this.org(organizationId); const id = cleanId(idValue, 'appointmentId'); const payload: JsonRecord = {};
    if (input.startsAt !== undefined) payload.starts_at = isoDate(input.startsAt, 'startsAt');
    if (input.endsAt !== undefined) payload.ends_at = isoDate(input.endsAt, 'endsAt');
    if (input.status !== undefined) { const status = String(input.status); if (!allowedAppointmentStatuses.has(status)) throw new FleetOperationsError('Appointment status is invalid', 400); payload.status = status; }
    for (const [camel, snake] of [['workOrderId','work_order_id'],['customerId','customer_id'],['vehicleId','vehicle_id'],['locationId','location_id'],['notes','notes']] as const) if (input[camel] !== undefined) payload[snake] = input[camel] || null;
    return this.request<JsonRecord[]>(this.token(authorization), `appointments?id=eq.${id}&organization_id=eq.${org}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async deleteAppointment(organizationId: unknown, authorization: string | undefined, idValue: unknown) {
    const org = this.org(organizationId); const id = cleanId(idValue, 'appointmentId');
    await this.request<unknown>(this.token(authorization), `appointments?id=eq.${id}&organization_id=eq.${org}`, { method: 'DELETE' });
    return { deleted: true, id };
  }

  async listDispatch(organizationId: unknown, authorization?: string) {
    const org = this.org(organizationId); const token = this.token(authorization);
    const q = new URLSearchParams({ select: '*', organization_id: `eq.${org}`, order: 'created_at.desc', limit: '200' });
    return this.request<JsonRecord[]>(token, `dispatch_assignments?${q}`);
  }

  async createDispatch(organizationId: unknown, authorization: string | undefined, input: JsonRecord) {
    const org = this.org(organizationId); const status = String(input.status || 'assigned');
    if (!allowedDispatchStatuses.has(status)) throw new FleetOperationsError('Dispatch status is invalid', 400);
    const payload = { organization_id: org, work_order_id: cleanId(input.workOrderId, 'workOrderId'), appointment_id: input.appointmentId || null, technician_id: cleanId(input.technicianId, 'technicianId'), resource_id: input.resourceId || null, status, starts_at: input.startsAt ? isoDate(input.startsAt, 'startsAt') : null };
    return this.request<JsonRecord[]>(this.token(authorization), 'dispatch_assignments', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateDispatch(organizationId: unknown, authorization: string | undefined, idValue: unknown, input: JsonRecord) {
    const org = this.org(organizationId); const id = cleanId(idValue, 'dispatchId'); const payload: JsonRecord = {};
    if (input.status !== undefined) { const status = String(input.status); if (!allowedDispatchStatuses.has(status)) throw new FleetOperationsError('Dispatch status is invalid', 400); payload.status = status; if (status === 'arrived') payload.arrived_at = new Date().toISOString(); if (status === 'completed') payload.completed_at = new Date().toISOString(); }
    for (const [camel, snake] of [['technicianId','technician_id'],['resourceId','resource_id'],['appointmentId','appointment_id']] as const) if (input[camel] !== undefined) payload[snake] = input[camel] || null;
    if (input.startsAt !== undefined) payload.starts_at = input.startsAt ? isoDate(input.startsAt, 'startsAt') : null;
    return this.request<JsonRecord[]>(this.token(authorization), `dispatch_assignments?id=eq.${id}&organization_id=eq.${org}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async deleteDispatch(organizationId: unknown, authorization: string | undefined, idValue: unknown) {
    const org = this.org(organizationId); const id = cleanId(idValue, 'dispatchId');
    await this.request<unknown>(this.token(authorization), `dispatch_assignments?id=eq.${id}&organization_id=eq.${org}`, { method: 'DELETE' });
    return { deleted: true, id };
  }

  async references(organizationId: unknown, authorization?: string) {
    const org = this.org(organizationId); const token = this.token(authorization);
    const tables = ['customers','vehicles','work_orders','technicians','resources','appointments'] as const;
    const values = await Promise.all(tables.map(table => this.request<JsonRecord[]>(token, `${table}?organization_id=eq.${org}&limit=200`)));
    return Object.fromEntries(tables.map((table, index) => [table, (values[index] || []).filter((row) => row && typeof row === 'object')]));
  }
}
