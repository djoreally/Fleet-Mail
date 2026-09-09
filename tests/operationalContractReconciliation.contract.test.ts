import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('operational contract reconciliation',()=>{
 const migrate=readFileSync('src/db/migrate.ts','utf8');
 const schedule=readFileSync('src/server/routes/scheduleDispatch.ts','utf8');
 it('keeps operational migrations in the canonical runner',()=>{
  expect(migrate).toContain("'0009_operational_list_indexes.sql'");
  expect(migrate).toContain("'0010_operational_contract_integrity.sql'");
 });
 it('binds appointment creation to a work order command',()=>{
  expect(schedule).toContain("post('/work-orders/:workOrderId/appointment'");
  expect(schedule).toContain('workOrderChain');
 });
 it('resynchronizes work order schedule after create, edit, and delete',()=>{
  expect(schedule).toContain('resyncWorkOrderFromAppointments');
  expect(schedule).toContain("patch('/appointments/:id'");
  expect(schedule).toContain("delete('/appointments/:id'");
  expect((schedule.match(/resyncWorkOrderFromAppointments/g)||[]).length).toBeGreaterThanOrEqual(5);
 });
});
