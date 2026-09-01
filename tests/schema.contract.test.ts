import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/drizzleSchema';

const tenantTables = [
  schema.customers,
  schema.vehicles,
  schema.workOrders,
  schema.appointments,
  schema.dispatchAssignments,
  schema.maintenanceSchedules,
  schema.invoices,
  schema.inspectionItems,
  schema.fluidUsage,
  schema.serviceLines,
  schema.documents,
  schema.emails
];

describe('Fleet OS schema contract', () => {
  it('exports the core request-to-invoice entities', () => {
    expect(schema.organizations).toBeDefined();
    expect(schema.customers).toBeDefined();
    expect(schema.vehicles).toBeDefined();
    expect(schema.workOrders).toBeDefined();
    expect(schema.appointments).toBeDefined();
    expect(schema.dispatchAssignments).toBeDefined();
    expect(schema.inspections).toBeDefined();
    expect(schema.inspectionItems).toBeDefined();
    expect(schema.fluidUsage).toBeDefined();
    expect(schema.serviceLines).toBeDefined();
    expect(schema.authorizations).toBeDefined();
    expect(schema.invoices).toBeDefined();
  });

  it.each(tenantTables)('requires organization_id on tenant-owned table %#', (table) => {
    const organizationId = getTableConfig(table).columns.find((column) => column.name === 'organization_id');
    expect(organizationId, 'organization_id column is required').toBeDefined();
    expect(organizationId?.notNull, 'organization_id must be NOT NULL').toBe(true);
  });
});
