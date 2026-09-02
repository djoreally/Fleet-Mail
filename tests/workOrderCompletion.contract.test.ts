import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('validated technician work-order completion', () => {
  it('blocks unresolved inspections, authorizations, and service lines', () => {
    const source = readFileSync('src/server/services/workOrderCompletion.ts', 'utf8');
    expect(source).toContain('A completed inspection is required');
    expect(source).toContain('Pending authorizations must be decided');
    expect(source).toContain('All authorized service lines must be completed');
  });

  it('uses organization-scoped canonical tables and transition service', () => {
    const source = readFileSync('src/server/services/workOrderCompletion.ts', 'utf8');
    expect(source).toContain('eq(workOrders.organizationId, organizationId)');
    expect(source).toContain('eq(inspections.organizationId, organizationId)');
    expect(source).toContain('workOrderExecutionService.transition');
  });

  it('intercepts legacy complete transitions before the execution router', () => {
    const route = readFileSync('src/server/routes/workOrderCompletion.ts', 'utf8');
    const app = readFileSync('src/server/app.ts', 'utf8');
    expect(route).toContain("status !== 'complete'");
    expect(app.indexOf('workOrderCompletionRouter')).toBeLessThan(app.lastIndexOf('workOrderExecutionRouter'));
  });
});
