import { Pool } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

export type VehicleStatus = 'active' | 'in_service' | 'out_of_service';

export interface VehicleInput {
  id?: string;
  unitNumber: string;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  mileage?: number | null;
  status?: VehicleStatus;
  trim?: string | null;
  type?: string | null;
  assignment?: string | null;
}

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const statuses = new Set<VehicleStatus>(['active', 'in_service', 'out_of_service']);

function databaseUrl(): string {
  const value = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new VehicleStoreError('Database is not configured', 503);
  return value;
}

export class VehicleStoreError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

function normalize(input: VehicleInput): Required<Omit<VehicleInput, 'id'>> {
  const unitNumber = String(input.unitNumber || '').trim();
  const vin = input.vin ? String(input.vin).trim().toUpperCase() : null;
  const year = input.year === null || input.year === undefined || input.year === 0 ? null : Number(input.year);
  const mileage = input.mileage === null || input.mileage === undefined ? 0 : Number(input.mileage);
  const status = input.status || 'active';
  if (!unitNumber) throw new VehicleStoreError('Unit number is required');
  if (vin && !VIN_PATTERN.test(vin)) throw new VehicleStoreError('VIN must be 17 characters and cannot contain I, O, or Q');
  if (year !== null && (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 2)) throw new VehicleStoreError('Vehicle year is invalid');
  if (!Number.isInteger(mileage) || mileage < 0) throw new VehicleStoreError('Mileage must be a non-negative whole number');
  if (!statuses.has(status)) throw new VehicleStoreError('Vehicle status is invalid');
  return {
    unitNumber, vin, year, mileage, status,
    make: input.make?.trim() || null,
    model: input.model?.trim() || null,
    engine: input.engine?.trim() || null,
    trim: input.trim?.trim() || null,
    type: input.type?.trim() || null,
    assignment: input.assignment?.trim() || null,
  };
}

async function withPool<T>(work: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: databaseUrl() });
  try { return await work(pool); } finally { await pool.end(); }
}

type Queryable = Pick<Pool, 'query'>;

async function resolveOrganizationId(pool: Pool, requested?: string): Promise<string> {
  const configured = process.env.FLEET_ORGANIZATION_ID?.trim();
  const candidate = requested?.trim() || configured;
  if (candidate) {
    const found = await pool.query('SELECT id FROM organizations WHERE id = $1 AND status = $2 LIMIT 1', [candidate, 'active']);
    if (!found.rows[0]) throw new VehicleStoreError('Active organization not found', 404);
    return String(found.rows[0].id);
  }
  const result = await pool.query('SELECT id FROM organizations WHERE status = $1 ORDER BY created_at LIMIT 2', ['active']);
  if (result.rows.length === 1) return String(result.rows[0].id);
  if (result.rows.length === 0) throw new VehicleStoreError('No active organization has been provisioned', 503);
  throw new VehicleStoreError('Organization context is required', 401);
}

const selectColumns = `id, organization_id, unit_number, vin, year, make, model, engine, mileage, status,
  metadata, created_at, updated_at`;

export async function listVehicles(requestedOrganizationId?: string) {
  return withPool(async pool => {
    const organizationId = await resolveOrganizationId(pool, requestedOrganizationId);
    const result = await pool.query(`SELECT ${selectColumns} FROM vehicles WHERE organization_id = $1 ORDER BY updated_at DESC`, [organizationId]);
    return { organizationId, vehicles: result.rows };
  });
}

async function insertVehicle(pool: Queryable, organizationId: string, raw: VehicleInput) {
  const value = normalize(raw);
  const metadata = { trim: value.trim, type: value.type, assignment: value.assignment };
  try {
    const result = await pool.query(`INSERT INTO vehicles
      (id, organization_id, unit_number, vin, year, make, model, engine, mileage, status, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING ${selectColumns}`,
      [randomUUID(), organizationId, value.unitNumber, value.vin, value.year, value.make, value.model, value.engine, value.mileage, value.status, JSON.stringify(metadata)]);
    return result.rows[0];
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) throw new VehicleStoreError(`Unit ${value.unitNumber} already exists`, 409);
    throw error;
  }
}

export async function createVehicle(raw: VehicleInput, requestedOrganizationId?: string) {
  return withPool(async pool => {
    const organizationId = await resolveOrganizationId(pool, requestedOrganizationId);
    return insertVehicle(pool, organizationId, raw);
  });
}

export async function importVehicles(raw: VehicleInput[], requestedOrganizationId?: string) {
  if (!Array.isArray(raw) || raw.length === 0) throw new VehicleStoreError('At least one vehicle is required');
  if (raw.length > 500) throw new VehicleStoreError('A maximum of 500 vehicles can be imported');
  return withPool(async pool => {
    const organizationId = await resolveOrganizationId(pool, requestedOrganizationId);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const vehicles = [];
      for (const value of raw) vehicles.push(await insertVehicle(client, organizationId, value));
      await client.query('COMMIT');
      return vehicles;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });
}

export async function updateVehicle(id: string, raw: VehicleInput, requestedOrganizationId?: string) {
  if (!id.trim()) throw new VehicleStoreError('Vehicle id is required');
  return withPool(async pool => {
    const organizationId = await resolveOrganizationId(pool, requestedOrganizationId);
    const value = normalize(raw);
    const metadata = { trim: value.trim, type: value.type, assignment: value.assignment };
    const result = await pool.query(`UPDATE vehicles SET unit_number=$3, vin=$4, year=$5, make=$6, model=$7,
      engine=$8, mileage=$9, status=$10, metadata=$11::jsonb, updated_at=NOW()
      WHERE organization_id=$1 AND id=$2 RETURNING ${selectColumns}`,
      [organizationId, id, value.unitNumber, value.vin, value.year, value.make, value.model, value.engine, value.mileage, value.status, JSON.stringify(metadata)]);
    if (!result.rows[0]) throw new VehicleStoreError('Vehicle not found', 404);
    return result.rows[0];
  });
}

export async function deleteVehicle(id: string, requestedOrganizationId?: string) {
  return withPool(async pool => {
    const organizationId = await resolveOrganizationId(pool, requestedOrganizationId);
    const result = await pool.query('DELETE FROM vehicles WHERE organization_id=$1 AND id=$2', [organizationId, id]);
    if (!result.rowCount) throw new VehicleStoreError('Vehicle not found', 404);
  });
}
