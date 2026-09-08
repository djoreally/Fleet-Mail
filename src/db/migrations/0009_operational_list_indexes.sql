-- Indexes supporting bounded keyset pagination for operational registries.
CREATE INDEX IF NOT EXISTS customers_org_updated_id_idx ON public.customers (organization_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS vehicles_org_updated_id_idx ON public.vehicles (organization_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS prospects_org_updated_id_idx ON public.prospects (organization_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS prospects_org_stage_updated_id_idx ON public.prospects (organization_id, stage, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS work_orders_org_updated_id_idx ON public.work_orders (organization_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS work_orders_org_technician_updated_id_idx ON public.work_orders (organization_id, technician_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS work_orders_org_customer_status_idx ON public.work_orders (organization_id, customer_id, status);
CREATE INDEX IF NOT EXISTS fleet_service_agreements_org_customer_updated_idx ON public.fleet_service_agreements (organization_id, customer_id, updated_at DESC, id DESC);
INSERT INTO public.app_schema_migrations(name) VALUES ('0009_operational_list_indexes.sql') ON CONFLICT (name) DO NOTHING;
