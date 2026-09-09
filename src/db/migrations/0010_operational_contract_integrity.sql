DROP INDEX IF EXISTS public.vehicles_org_unit_uq;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_org_customer_unit_uq
ON public.vehicles (organization_id, customer_id, unit_number);

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_work_order_id_work_orders_id_fk;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_work_order_id_work_orders_id_fk
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE RESTRICT;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_time_window_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_time_window_check CHECK (ends_at > starts_at);

ALTER TABLE public.fleet_service_agreements
  DROP CONSTRAINT IF EXISTS fleet_service_agreements_date_window_check;
ALTER TABLE public.fleet_service_agreements
  ADD CONSTRAINT fleet_service_agreements_date_window_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
ALTER TABLE public.fleet_service_agreements
  DROP CONSTRAINT IF EXISTS fleet_service_agreements_sla_positive_check;
ALTER TABLE public.fleet_service_agreements
  ADD CONSTRAINT fleet_service_agreements_sla_positive_check CHECK (sla_hours > 0);
ALTER TABLE public.fleet_service_agreements
  DROP CONSTRAINT IF EXISTS fleet_service_agreements_approval_threshold_nonnegative_check;
ALTER TABLE public.fleet_service_agreements
  ADD CONSTRAINT fleet_service_agreements_approval_threshold_nonnegative_check CHECK (approval_threshold >= 0);
ALTER TABLE public.fleet_service_agreements
  DROP CONSTRAINT IF EXISTS fleet_service_agreements_dispatch_buffer_nonnegative_check;
ALTER TABLE public.fleet_service_agreements
  ADD CONSTRAINT fleet_service_agreements_dispatch_buffer_nonnegative_check CHECK (min_dispatch_buffer_minutes >= 0);

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_mileage_nonnegative_check;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_mileage_nonnegative_check CHECK (mileage IS NULL OR mileage >= 0);
ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_engine_hours_nonnegative_check;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_engine_hours_nonnegative_check CHECK (engine_hours IS NULL OR engine_hours >= 0);

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_odometer_nonnegative_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_odometer_nonnegative_check CHECK (odometer IS NULL OR odometer >= 0);
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_engine_hours_nonnegative_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_engine_hours_nonnegative_check CHECK (engine_hours IS NULL OR engine_hours >= 0);
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_labor_minutes_nonnegative_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_labor_minutes_nonnegative_check CHECK (labor_minutes >= 0);
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_travel_minutes_nonnegative_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_travel_minutes_nonnegative_check CHECK (travel_minutes >= 0);

INSERT INTO public.app_schema_migrations(name)
VALUES ('0010_operational_contract_integrity.sql')
ON CONFLICT (name) DO NOTHING;
