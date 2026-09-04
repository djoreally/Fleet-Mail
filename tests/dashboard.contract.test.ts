import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Fleet OS dashboard contract',()=>{
  const app=readFileSync('src/App.tsx','utf8');
  const sidebar=readFileSync('src/components/Sidebar.tsx','utf8');
  const dashboard=readFileSync('src/components/DashboardView.tsx','utf8');
  const route=readFileSync('src/server/routes/dashboard.ts','utf8');
  const server=readFileSync('src/server/app.ts','utf8');

  it('opens authenticated Fleet OS on the live dashboard',()=>{
    expect(app).toContain("useState<AppTab>('dashboard')");
    expect(app).toContain('<DashboardView');
    expect(sidebar).toContain("id=\"nav-dashboard\"");
    expect(dashboard).toContain("fleetFetch('/api/dashboard')");
  });

  it('uses canonical organization-scoped Fleet records only',()=>{
    expect(route).toContain('requireFleetOrganization(req)');
    expect(route).toContain('public.customers');
    expect(route).toContain('public.vehicles');
    expect(route).toContain('public.work_orders');
    expect(route).toContain('public.appointments');
    expect(route).toContain('public.authorizations');
    expect(route).toContain('public.invoices');
    expect(route).toContain('public.prospects');
    expect(server).toContain("app.use('/api', dashboardRouter)");
  });

  it('does not invent connected-vehicle or mileage telemetry',()=>{
    expect(route.toLowerCase()).not.toContain('smartcar');
    expect(dashboard.toLowerCase()).not.toContain('odometer');
    expect(dashboard).toContain('No mileage telemetry is assumed');
  });

  it('wires current operational modules from the dashboard',()=>{
    for(const tab of ['customers','vehicles','work-orders','maintenance','schedule','dispatch','prospects','financials','documents']) expect(dashboard).toContain(`'${tab}'`);
    expect(dashboard).toContain('onAskAgent');
  });
});
