import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertDispatchTransition, nextDispatchStatuses } from '../src/server/services/dispatchLifecycle';

const route = readFileSync('src/server/routes/scheduleDispatch.ts', 'utf8');
const ui = readFileSync('src/components/ScheduleDispatchView.tsx', 'utf8');

describe('schedule and dispatch lifecycle contract', () => {
  it('allows only canonical forward dispatch transitions plus cancellation', () => {
    expect(nextDispatchStatuses('assigned')).toEqual(['accepted', 'cancelled']);
    expect(nextDispatchStatuses('accepted')).toEqual(['en_route', 'cancelled']);
    expect(nextDispatchStatuses('en_route')).toEqual(['arrived', 'cancelled']);
    expect(nextDispatchStatuses('arrived')).toEqual(['working', 'cancelled']);
    expect(nextDispatchStatuses('working')).toEqual(['completed', 'cancelled']);
    expect(nextDispatchStatuses('completed')).toEqual([]);
    expect(() => assertDispatchTransition('assigned', 'completed')).toThrow(/Illegal dispatch transition/);
  });

  it('routes status changes through the dedicated lifecycle endpoint', () => {
    expect(route).toContain("patch('/dispatch/:id/status'");
    expect(route).toContain('transitionDispatchStatus');
    expect(route).toContain('Use the dispatch status transition endpoint for lifecycle changes');
    expect(ui).toContain("`/dispatch/${id}/status`");
  });

  it('records dispatch creation and transition history', () => {
    expect(route).toContain('recordDispatchCreated');
    const lifecycle = readFileSync('src/server/services/dispatchLifecycle.ts', 'utf8');
    expect(lifecycle).toContain('dispatch_status_history');
    expect(lifecycle).toContain("VALUES($1,$2,$3,'assigned'");
  });

  it('forces canonical starting states for appointments and dispatch', () => {
    expect(route).toContain("status:'scheduled'");
    expect(route).toContain("status:'assigned'");
  });

  it('makes the schedule form work-order-first with a mobile-safe picker and canonical command', () => {
    expect(ui).toContain('Picker label="Work order"');
    expect(ui).toContain('No work orders available. Create a work order first.');
    expect(ui).not.toContain("select('Customer','customerId'");
    expect(ui).not.toContain("select('Vehicle','vehicleId'");
    expect(ui).toContain('Service chain');
    expect(ui).toContain("`/work-orders/${encodeURIComponent(String(form.workOrderId))}/appointment`");
    expect(route).toContain("post('/work-orders/:workOrderId/appointment'");
  });

  it('prevents hard deletion of dispatch history', () => {
    expect(route).toContain('Cancel the dispatch instead of deleting it');
  });
});
