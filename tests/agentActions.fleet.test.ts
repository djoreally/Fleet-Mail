import { describe, expect, it } from 'vitest';
import { normalizeAgentAction } from '../src/server/services/agentActions.js';

describe('Fleet OS agent action contracts', () => {
  it('normalizes a work-order creation proposal without executing it', () => {
    const action = normalizeAgentAction('fleet.work_order.create', {
      vehicleId: 'vehicle-218',
      complaint: 'Oil and filter service',
      requestedServices: ['Oil change', 'Inspection'],
      odometer: 42110,
      priority: 'routine',
    });
    expect(action.kind).toBe('fleet.work_order.create');
    expect(action.payload.vehicleId).toBe('vehicle-218');
    expect(action.payload.odometer).toBe(42110);
  });

  it('accepts only explicit authorization decisions', () => {
    expect(() => normalizeAgentAction('fleet.authorization.decision', {
      authorizationId: 'auth-1', decision: 'maybe',
    })).toThrow(/authorized or rejected/i);
    expect(normalizeAgentAction('fleet.authorization.decision', {
      authorizationId: 'auth-1', decision: 'authorized', authorizedBy: 'Fleet manager',
    }).payload.decision).toBe('authorized');
  });

  it('rejects incomplete work-order transitions', () => {
    expect(() => normalizeAgentAction('fleet.work_order.transition', { workOrderId: 'wo-1' })).toThrow(/Status is required/);
  });
});
