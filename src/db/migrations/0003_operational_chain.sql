-- Forward-only expansion of the unit-first Fleet OS operational chain.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_email text,
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS po_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_po_number text,
  ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT 'net_30',
  ADD COLUMN IF NOT EXISTS tax_status text NOT NULL DEFAULT 'taxable';
CREATE UNIQUE INDEX IF NOT EXISTS customers_org_account_uq ON customers (organization_id, account_number);

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS trim text,
  ADD COLUMN IF NOT EXISTS fuel_type text,
  ADD COLUMN IF NOT EXISTS license_plate text,
  ADD COLUMN IF NOT EXISTS registration_state text,
  ADD COLUMN IF NOT EXISTS engine_hours integer,
  ADD COLUMN IF NOT EXISTS assigned_driver text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS in_service_date timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS technician_id text REFERENCES technicians(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS odometer integer,
  ADD COLUMN IF NOT EXISTS engine_hours integer,
  ADD COLUMN IF NOT EXISTS purchase_order_number text,
  ADD COLUMN IF NOT EXISTS requested_services text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS customer_notes text,
  ADD COLUMN IF NOT EXISTS technician_notes text,
  ADD COLUMN IF NOT EXISTS labor_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS engine_hours integer;
CREATE TABLE IF NOT EXISTS inspection_items (
  id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inspection_id text NOT NULL REFERENCES inspections(id) ON DELETE CASCADE, name text NOT NULL,
  condition text NOT NULL, measurement text, recommendation text, severity text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb, position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inspection_items_org_inspection_idx ON inspection_items(organization_id, inspection_id);

ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS program text,
  ADD COLUMN IF NOT EXISTS interval_engine_hours integer,
  ADD COLUMN IF NOT EXISTS last_service_mileage integer,
  ADD COLUMN IF NOT EXISTS last_service_engine_hours integer,
  ADD COLUMN IF NOT EXISTS last_service_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_due_engine_hours integer;

ALTER TABLE part_usage
  ADD COLUMN IF NOT EXISTS inventory_id text REFERENCES inventory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sell_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS lot_sku text;
CREATE TABLE IF NOT EXISTS fluid_usage (
  id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_order_id text NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE, name text NOT NULL,
  specification text, viscosity text, quantity numeric(12,3) NOT NULL,
  unit_cost numeric(12,2), sell_price numeric(12,2), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fluid_usage_org_wo_idx ON fluid_usage(organization_id, work_order_id);
CREATE TABLE IF NOT EXISTS service_lines (
  id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_order_id text NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  maintenance_schedule_id text REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
  description text NOT NULL, kind text NOT NULL DEFAULT 'labor', labor_minutes integer NOT NULL DEFAULT 0,
  quantity numeric(12,3) NOT NULL DEFAULT 1, unit_price numeric(12,2) NOT NULL DEFAULT 0,
  authorized boolean NOT NULL DEFAULT false, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_lines_org_wo_idx ON service_lines(organization_id, work_order_id);

-- Every added tenant table receives the existing membership policy.
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_member_access ON inspection_items;
CREATE POLICY tenant_member_access ON inspection_items FOR ALL USING (app.is_org_member(organization_id)) WITH CHECK (app.is_org_member(organization_id));
ALTER TABLE fluid_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluid_usage FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_member_access ON fluid_usage;
CREATE POLICY tenant_member_access ON fluid_usage FOR ALL USING (app.is_org_member(organization_id)) WITH CHECK (app.is_org_member(organization_id));
ALTER TABLE service_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_member_access ON service_lines;
CREATE POLICY tenant_member_access ON service_lines FOR ALL USING (app.is_org_member(organization_id)) WITH CHECK (app.is_org_member(organization_id));
