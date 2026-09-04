import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Dispatcher OS foundation', () => {
  const route = readFileSync('src/server/routes/dispatcher.ts','utf8');
  const app = readFileSync('src/server/app.ts','utf8');
  const dashboard = readFileSync('src/components/DashboardView.tsx','utf8');

  it('requires dispatcher access and returns deterministic queues', () => {
    expect(route).toContain("requireFleetPermission(req,'dispatch.view')");
    expect(route).toContain("access.role!=='dispatcher'");
    expect(route).toContain('unassigned:');
    expect(route).toContain('inProgress:');
    expect(route).toContain('exceptions:');
  });

  it('includes technician capacity and authorization exceptions', () => {
    expect(route).toContain('public.technicians');
    expect(route).toContain('public.availability');
    expect(route).toContain("a.status='pending'");
  });

  it('mounts a dedicated authenticated dispatcher surface', () => {
    expect(app).toContain("app.use('/api/dispatcher',requireFleetSession)");
    expect(app).toContain("app.use('/api/dispatcher',dispatcherRouter)");
    expect(dashboard).toContain("a.role==='dispatcher'");
    expect(dashboard).toContain('Dispatcher OS');
    expect(dashboard).toContain('Run the service day');
  });
});
