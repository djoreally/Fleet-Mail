import { serverConfig } from '../config.js';
import { randomUUID } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export class FleetOperationsError extends Error {
  constructor(message: string, readonly status = 500) { super(message); }
}

const allowedDispatchStatuses = new Set(['assigned', 'accepted', 'en_route', 'arrived', 'working', 'completed', 'cancelled']);
const allowedAppointmentStatuses = new Set(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']);
const inactiveStatuses = new Set(['completed', 'cancelled', 'no_show']);

function cleanId(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new FleetOperationsError(`${name} is invalid`, 400);
  return value;
}

function isoDate(value: unknown, name: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new FleetOperationsError(`${name} must be an ISO date`, 400);
  return new Date(value).toISOString();
}

function overlaps(startA: string, endA: string, startB: unknown, endB: unknown) {
  if (!startB || !endB) return false;
  const a1 = Date.parse(startA); const a2 = Date.parse(endA); const b1 = Date.parse(String(startB)); const b2 = Date.parse(String(endB));
  return Number.isFinite(b1) && Number.isFinite(b2) && a1 < b2 && b1 < a2;
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

  private async assertReference(token: string, org: string, table: 'customers' | 'vehicles' | 'work_orders' | 'technicians' | 'resources', value: unknown, label: string) {
    if (value === undefined || value === null || value === '') return null;
    const id = cleanId(value, label);
    const q = new URLSearchParams({ select: 'id', id: `eq.${id}`, organization_id: `eq.${org}`, limit: '1' });
    const rows = await this.request<JsonRecord[]>(token, `${table}?${q}`);
    if (!rows.length) throw new FleetOperationsError(`${label} was not found in this organization`, 404);
    return id;
  }

  private async assertAppointmentSlot(token: string, org: string, startsAt: string, endsAt: string, vehicleId?: unknown, excludeId?: string) {
    if (!vehicleId) return;
    const vehicle = cleanId(vehicleId, 'vehicleId');
    const q = new URLSearchParams({ select: 'id,status,starts_at,ends_at', organization_id: `eq.${org}`, vehicle_id: `eq.${vehicle}`, limit: '200' });
    const rows = await this.request<JsonRecord[]>(token, `appointments?${q}`);
    const conflict = rows.find((row) => row.id !== excludeId && !inactiveStatuses.has(String(row.status)) && overlaps(startsAt, endsAt, row.starts_at, row.ends_at));
    if (conflict) throw new FleetOperationsError('Vehicle already has an overlapping appointment', 409);
  }

  private async appointmentWindow(token: string, org: string, appointmentId: unknown) {
    const id = cleanId(appointmentId, 'appointmentId');
    const q = new URLSearchParams({ select: 'id,starts_at,ends_at,vehicle_id', id: `eq.${id}`, organization_id: `eq.${org}`, limit: '1' });
    const [row] = await this.request<JsonRecord[]>(token, `appointments?${q}`);
    if (!row) throw new FleetOperationsError('Appointment not found', 404);
    return { id, startsAt: isoDate(row.starts_at, 'appointment startsAt'), endsAt: isoDate(row.ends_at, 'appointment endsAt'), vehicleId: row.vehicle_id ? String(row.vehicle_id) : null };
  }

  private async assertDispatchSlot(token: string, org: string, technicianId: string, resourceId: string | null, startsAt: string, endsAt: string, excludeId?: string) {
    const q = new URLSearchParams({ select: 'id,status,technician_id,resource_id,starts_at,appointment_id', organization_id: `eq.${org}`, limit: '200' });
    const rows = await this.request<JsonRecord[]>(token, `dispatch_assignments?${q}`);
    for (const row of rows) {
      if (row.id === excludeId || ['completed','cancelled'].includes(String(row.status))) continue;
      const sameTech = String(row.technician_id || '') === technicianId;
      const sameResource = Boolean(resourceId) && String(row.resource_id || '') === resourceId;
      if (!sameTech && !sameResource) continue;
      let rowEnd = row.starts_at;
      if (row.appointment_id) {
        try { rowEnd = (await this.appointmentWindow(token, org, row.appointment_id)).endsAt; } catch { /* preserve conservative start-only fallback */ }
      }
      if (row.starts_at && overlaps(startsAt, endsAt, row.starts_at, rowEnd)) {
        throw new FleetOperationsError(sameTech ? 'Technician already has an overlapping dispatch' : 'Resource already has an overlapping dispatch', 409);
      }
    }

    const availabilityQuery = new URLSearchParams({ select: 'id,technician_id,resource_id,starts_at,ends_at,status', organization_id: `eq.${org}`, limit: '200' });
    const availabilityRows = await this.request<JsonRecord[]>(token, `availability?${availabilityQuery}`);
    const relevant = availabilityRows.filter((row) => String(row.technician_id || '') === technicianId || (resourceId && String(row.resource_id || '') === resourceId));
    const blocking = relevant.find((row) => String(row.status) !== 'available' && overlaps(startsAt, endsAt, row.starts_at, row.ends_at));
    if (blocking) throw new FleetOperationsError('Technician or resource is unavailable for the requested time', 409);
  }

  async listAppointments(organizationId: unknown, authorization?: string, from?: unknown, to?: unknown) {
    const org = this.org(organizationId); const token = this.token(authorization);
    const query = new URLSearchParams({ select: '*', organization_id: `eq.${org}`, order: 'starts_at.asc', limit: '200' });
    if (from) query.set('starts_at', `gte.${isoDate(from, 'from')}`);
    if (to) query.append('starts_at', `lt.${isoDate(to, 'to')}`);
    return this.request<JsonRecord[]>(token, `appointments?${query}`);
  }

  async createAppointment(organizationId: unknown, authorization: string | undefined, input: JsonRecord) {
    const org = this.org(organizationId); const token = this.token(authorization); const startsAt = isoDate(input.startsAt, 'startsAt'); const endsAt = isoDate(input.endsAt, 'endsAt');
    if (endsAt <= startsAt) throw new FleetOperationsError('endsAt must be after startsAt', 400);
    const status = String(input.status || 'scheduled');
    if (!allowedAppointmentStatuses.has(status)) throw new FleetOperationsError('Appointment status is invalid', 400);
    const [customerId, vehicleId, workOrderId] = await Promise.all([
      this.assertReference(token, org, 'customers', input.customerId, 'customerId'),
      this.assertReference(token, org, 'vehicles', input.vehicleId, 'vehicleId'),
      this.assertReference(token, org, 'work_orders', input.workOrderId, 'workOrderId'),
    ]);
    await this.assertAppointmentSlot(token, org, startsAt, endsAt, vehicleId);
    const payload = { id: randomUUID(), organization_id: org, work_order_id: workOrderId, customer_id: customerId, vehicle_id: vehicleId, location_id: input.locationId || null, starts_at: startsAt, ends_at: endsAt, status, notes: input.notes || null };
    return this.request<JsonRecord[]>(token, 'appointments', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateAppointment(organizationId: unknown, authorization: string | undefined, idValue: unknown, input: JsonRecord) {
    const org = this.org(organizationId); const token = this.token(authorization); const id = cleanId(idValue, 'appointmentId'); const payload: JsonRecord = {};
    const current = await this.appointmentWindow(token, org, id);
    const startsAt = input.startsAt !== undefined ? isoDate(input.startsAt, 'startsAt') : current.startsAt;
    const endsAt = input.endsAt !== undefined ? isoDate(input.endsAt, 'endsAt') : current.endsAt;
    if (endsAt <= startsAt) throw new FleetOperationsError('endsAt must be after startsAt', 400);
    if (input.startsAt !== undefined) payload.starts_at = startsAt;
    if (input.endsAt !== undefined) payload.ends_at = endsAt;
    if (input.status !== undefined) { const status = String(input.status); if (!allowedAppointmentStatuses.has(status)) throw new FleetOperationsError('Appointment status is invalid', 400); payload.status = status; }
    for (const [camel, snake] of [['workOrderId','work_order_id'],['customerId','customer_id'],['vehicleId','vehicle_id'],['locationId','location_id'],['notes','notes']] as const) if (input[camel] !== undefined) payload[snake] = input[camel] || null;
    const vehicleId = input.vehicleId !== undefined ? input.vehicleId : current.vehicleId;
    if (vehicleId) await this.assertAppointmentSlot(token, org, startsAt, endsAt, vehicleId, id);
    return this.request<JsonRecord[]>(token, `appointments?id=eq.${id}&organization_id=eq.${org}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async deleteAppointment(organizationId: unknown, authorization: string | undefined, idValue: unknown) {
    const org = this.org(organizationId); const id = cleanId(idValue, 'appointmentId');
    await this.request<unknown>(this.token(authorization), `appointments?id=eq.${id}&organization_id=eq.${org}`, { method: 'DELETE' });
    return { deleted: true, id };
  }

  private async dispatchState(token: string, org: string, dispatchId: string) {
    const q = new URLSearchParams({ select: 'id,technician_id,resource_id,appointment_id,starts_at,status', id: `eq.${dispatchId}`, organization_id: `eq.${org}`, limit: '1' });
    const [row] = await this.request<JsonRecord[]>(token, `dispatch_assignments?${q}`);
    if (!row) throw new FleetOperationsError('Dispatch not found', 404);
    return row;
  }

  async listDispatch(organizationId: unknown, authorization?: string) {
    const org = this.org(organizationId); const token = this.token(authorization);
    const q = new URLSearchParams({ select: '*', organization_id: `eq.${org}`, order: 'created_at.desc', limit: '200' });
    return this.request<JsonRecord[]>(token, `dispatch_assignments?${q}`);
  }

  async createDispatch(organizationId: unknown, authorization: string | undefined, input: JsonRecord) {
    const org = this.org(organizationId); const token = this.token(authorization); const status = String(input.status || 'assigned');
    if (!allowedDispatchStatuses.has(status)) throw new FleetOperationsError('Dispatch status is invalid', 400);
    const [workOrderId, technicianId, resourceId] = await Promise.all([
      this.assertReference(token, org, 'work_orders', input.workOrderId, 'workOrderId'),
      this.assertReference(token, org, 'technicians', input.technicianId, 'technicianId'),
      this.assertReference(token, org, 'resources', input.resourceId, 'resourceId'),
    ]);
    if (!workOrderId || !technicianId) throw new FleetOperationsError('Work order and technician are required', 400);
    const appointment = input.appointmentId ? await this.appointmentWindow(token, org, input.appointmentId) : null;
    const startsAt = input.startsAt ? isoDate(input.startsAt, 'startsAt') : appointment?.startsAt || null;
    if (startsAt && appointment) await this.assertDispatchSlot(token, org, technicianId, resourceId, startsAt, appointment.endsAt);
    const payload = { id: randomUUID(), organization_id: org, work_order_id: workOrderId, appointment_id: input.appointmentId || null, technician_id: technicianId, resource_id: resourceId, status, starts_at: startsAt };
    return this.request<JsonRecord[]>(token, 'dispatch_assignments', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateDispatch(organizationId: unknown, authorization: string | undefined, idValue: unknown, input: JsonRecord) {
    const org = this.org(organizationId); const token = this.token(authorization); const id = cleanId(idValue, 'dispatchId'); const payload: JsonRecord = {};
    if (input.status !== undefined) { const status = String(input.status); if (!allowedDispatchStatuses.has(status)) throw new FleetOperationsError('Dispatch status is invalid', 400); payload.status = status; if (status === 'arrived') payload.arrived_at = new Date().toISOString(); if (status === 'completed') payload.completed_at = new Date().toISOString(); }
    for (const [camel, snake] of [['technicianId','technician_id'],['resourceId','resource_id'],['appointmentId','appointment_id']] as const) if (input[camel] !== undefined) payload[snake] = input[camel] || null;
    if (input.startsAt !== undefined) payload.starts_at = input.startsAt ? isoDate(input.startsAt, 'startsAt') : null;
    const current = await this.dispatchState(token, org, id);
    const appointmentId = input.appointmentId !== undefined ? input.appointmentId : current.appointment_id;
    const technicianId = input.technicianId !== undefined ? input.technicianId : current.technician_id;
    const resourceId = input.resourceId !== undefined ? input.resourceId : current.resource_id;
    if (input.technicianId !== undefined) await this.assertReference(token, org, 'technicians', input.technicianId, 'technicianId');
    if (input.resourceId !== undefined) await this.assertReference(token, org, 'resources', input.resourceId, 'resourceId');
    if (appointmentId && technicianId) {
      const appointment = await this.appointmentWindow(token, org, appointmentId);
      const start = input.startsAt !== undefined && input.startsAt ? isoDate(input.startsAt, 'startsAt') : appointment.startsAt;
      await this.assertDispatchSlot(token, org, cleanId(technicianId, 'technicianId'), resourceId ? cleanId(resourceId, 'resourceId') : null, start, appointment.endsAt, id);
    }
    return this.request<JsonRecord[]>(token, `dispatch_assignments?id=eq.${id}&organization_id=eq.${org}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async deleteDispatch(organizationId: unknown, authorization: string | undefined, idValue: unknown) {
    const org = this.org(organizationId); const id = cleanId(idValue, 'dispatchId');
    await this.request<unknown>(this.token(authorization), `dispatch_assignments?id=eq.${id}&organization_id=eq.${org}`, { method: 'DELETE' });
    return { deleted: true, id };
  }

  async references(organizationId: unknown, authorization?: string) {
    const org = this.org(organizationId); const token = this.token(authorization);
    const tables = ['customers','vehicles','work_orders','technicians','resources','appointments','availability'] as const;
    const values = await Promise.all(tables.map(table => this.request<JsonRecord[]>(token, `${table}?organization_id=eq.${org}&limit=200`)));
    return Object.fromEntries(tables.map((table, index) => [table, (values[index] || []).filter((row) => row && typeof row === 'object')]));
  }
}
