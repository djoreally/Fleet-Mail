import { describe, expect, it } from 'vitest';
import { calculateDueState } from './operationsPersistence.js';

describe('calculateDueState', () => {
  const now = new Date('2026-08-31T12:00:00.000Z');
  it('uses either mileage or date to identify overdue service', () => {
    expect(calculateDueState(new Date('2026-09-30'), 10_000, 10_050, now)).toBe('overdue');
    expect(calculateDueState(new Date('2026-08-30'), 12_000, 10_000, now)).toBe('overdue');
  });
  it('identifies the 500 mile and 30 day due-soon windows', () => {
    expect(calculateDueState(null, 10_500, 10_000, now)).toBe('due_soon');
    expect(calculateDueState(new Date('2026-09-20'), null, null, now)).toBe('due_soon');
  });
  it('preserves unknown and upcoming states', () => {
    expect(calculateDueState(null, null, null, now)).toBe('unknown');
    expect(calculateDueState(new Date('2026-12-01'), 20_000, 10_000, now)).toBe('upcoming');
  });
});
