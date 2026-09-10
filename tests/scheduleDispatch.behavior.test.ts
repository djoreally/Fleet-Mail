import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScheduleDispatchService } from '../src/server/services/scheduleDispatch.js';

describe('appointment lifecycle conflict checks', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(status = 'scheduled') {
    const current = { id: 'old', work_order_id: 'wo', vehicle_id: 'van', status,
      starts_at: '2026-09-10T12:00:00Z', ends_at: '2026-09-10T13:00:00Z' };
    const replacement = { ...current, id: 'replacement', status: 'scheduled' };
    const request = vi.fn(async (url: string, init: RequestInit = {}) => {
      const query = new URL(url).searchParams;
      expect(query.get('organization_id')).toBe('eq.org');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token');
      if (init.method === 'PATCH') return new Response(JSON.stringify([{ ...current, ...JSON.parse(String(init.body)) }]));
      return new Response(JSON.stringify(query.get('id') === 'eq.old' ? [current] : [current, replacement]));
    });
    vi.stubGlobal('fetch', request);
    return { service: new ScheduleDispatchService('https://example.test'), request };
  }

  it.each(['cancelled', 'completed', 'no_show'])('allows marking a conflicting appointment %s', async status => {
    const { service, request } = setup();
    await expect(service.updateAppointment('org', 'Bearer token', 'old', { status })).resolves.toMatchObject([{ status }]);
    expect(request.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
  });

  it('allows editing notes on a cancelled appointment after its replacement is booked', async () => {
    const { service } = setup('cancelled');
    await expect(service.updateAppointment('org', 'Bearer token', 'old', { notes: 'Customer requested cancellation' }))
      .resolves.toMatchObject([{ status: 'cancelled', notes: 'Customer requested cancellation' }]);
  });

  it('rejects reactivating an appointment when a replacement is active', async () => {
    const { service, request } = setup('cancelled');
    await expect(service.updateAppointment('org', 'Bearer token', 'old', { status: 'scheduled' }))
      .rejects.toMatchObject({ status: 409 });
    expect(request.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('still rejects a conflicting active appointment update', async () => {
    const { service, request } = setup();
    await expect(service.updateAppointment('org', 'Bearer token', 'old', { startsAt: '2026-09-10T12:15:00Z' }))
      .rejects.toMatchObject({ status: 409 });
    expect(request.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });
});
