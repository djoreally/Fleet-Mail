import { afterEach, describe, expect, it, vi } from 'vitest';
import { FleetOperationsError, ScheduleDispatchService } from './scheduleDispatch';

afterEach(() => vi.unstubAllGlobals());

describe('ScheduleDispatchService', () => {
  it('requires an authenticated Neon session', async () => {
    const service = new ScheduleDispatchService('https://db.test');
    await expect(service.listAppointments('org_1')).rejects.toMatchObject({ status: 401 });
  });

  it('scopes appointment reads to the organization and requested range', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new ScheduleDispatchService('https://db.test');
    await service.listAppointments('org_1', 'Bearer token', '2026-08-31T00:00:00Z', '2026-09-07T00:00:00Z');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('appointments?');
    expect(url).toContain('organization_id=eq.org_1');
    expect(url).toContain('starts_at=gte.');
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  it('rejects invalid appointment windows before writing', async () => {
    const service = new ScheduleDispatchService('https://db.test');
    await expect(service.createAppointment('org_1', 'Bearer token', {
      startsAt: '2026-09-01T12:00:00Z', endsAt: '2026-09-01T11:00:00Z', customerId: 'c1', vehicleId: 'v1',
    })).rejects.toBeInstanceOf(FleetOperationsError);
  });

  it('writes organization-scoped dispatch records with validated references and an allowed status', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.includes('/work_orders?')) return new Response('[{"id":"wo_1"}]', { status: 200 });
      if (target.includes('/technicians?')) return new Response('[{"id":"tech_1"}]', { status: 200 });
      if (target.endsWith('/dispatch_assignments') && init?.method === 'POST') return new Response('[{"id":"dispatch_1"}]', { status: 201 });
      return new Response('[]', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new ScheduleDispatchService('https://db.test');
    await service.createDispatch('org_1', 'Bearer token', { workOrderId: 'wo_1', technicianId: 'tech_1', status: 'assigned' });
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({ organization_id: 'org_1', work_order_id: 'wo_1', technician_id: 'tech_1', status: 'assigned' });
  });
});