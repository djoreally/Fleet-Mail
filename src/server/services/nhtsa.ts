const VPIC_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;
const VPIC_BATCH_SIZE = 50;

export interface VinDecodeRequest {
  vin: string;
  modelYear?: string | number;
  [metadata: string]: unknown;
}

export interface DecodedVehicle {
  vin: string;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  vehicleType: string | null;
  bodyClass: string | null;
  manufacturer: string | null;
  series: string | null;
  trim: string | null;
  driveType: string | null;
  fuelType: string | null;
  engineCylinders: number | null;
  engineDisplacementLiters: number | null;
  doors: number | null;
  grossVehicleWeightRating: string | null;
  plantCity: string | null;
  plantState: string | null;
  plantCountry: string | null;
  errorCode: string;
  errorText: string | null;
  valid: boolean;
}

type VpicRow = Record<string, unknown>;
type FetchLike = typeof fetch;

export class NhtsaError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = 'NhtsaError';
  }
}

export function normalizeVin(vin: unknown): string {
  return typeof vin === 'string' ? vin.trim().toUpperCase() : '';
}

export function isValidVin(vin: unknown): boolean {
  return VIN_PATTERN.test(normalizeVin(vin));
}

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function number(value: unknown): number | null {
  const normalized = text(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeVpicResult(row: VpicRow, requestedVin?: string): DecodedVehicle {
  const errorCode = text(row.ErrorCode) ?? '';
  const errorCodes = errorCode.split(',').map((code) => code.trim()).filter(Boolean);
  return {
    vin: normalizeVin(text(row.VIN) ?? requestedVin),
    make: text(row.Make),
    model: text(row.Model),
    modelYear: number(row.ModelYear),
    vehicleType: text(row.VehicleType),
    bodyClass: text(row.BodyClass),
    manufacturer: text(row.Manufacturer),
    series: text(row.Series),
    trim: text(row.Trim),
    driveType: text(row.DriveType),
    fuelType: text(row.FuelTypePrimary),
    engineCylinders: number(row.EngineCylinders),
    engineDisplacementLiters: number(row.DisplacementL),
    doors: number(row.Doors),
    grossVehicleWeightRating: text(row.GVWR),
    plantCity: text(row.PlantCity),
    plantState: text(row.PlantState),
    plantCountry: text(row.PlantCountry),
    errorCode,
    errorText: text(row.ErrorText),
    valid: errorCodes.length > 0 && errorCodes.every((code) => code === '0'),
  };
}

async function fetchVpic(
  url: string,
  init: RequestInit,
  fetcher: FetchLike,
  timeoutMs: number,
): Promise<{ Results?: VpicRow[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new NhtsaError(`NHTSA vPIC returned HTTP ${response.status}`);
    }
    const payload = await response.json() as { Results?: VpicRow[] };
    if (!Array.isArray(payload.Results)) {
      throw new NhtsaError('NHTSA vPIC returned an unexpected response');
    }
    return payload;
  } catch (error) {
    if (error instanceof NhtsaError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NhtsaError('NHTSA vPIC request timed out', 504);
    }
    throw new NhtsaError(error instanceof Error ? error.message : 'NHTSA vPIC request failed');
  } finally {
    clearTimeout(timeout);
  }
}

export async function decodeVin(
  request: VinDecodeRequest,
  options: { fetcher?: FetchLike; timeoutMs?: number } = {},
): Promise<DecodedVehicle> {
  const vin = normalizeVin(request.vin);
  if (!isValidVin(vin)) {
    throw new NhtsaError('VIN must be 17 characters and cannot contain I, O, or Q', 400);
  }

  const url = new URL(`${VPIC_BASE_URL}/DecodeVinValues/${encodeURIComponent(vin)}`);
  url.searchParams.set('format', 'json');
  if (request.modelYear !== undefined && String(request.modelYear).trim()) {
    url.searchParams.set('modelyear', String(request.modelYear).trim());
  }

  const payload = await fetchVpic(url.toString(), { method: 'GET' }, options.fetcher ?? fetch, options.timeoutMs ?? 8_000);
  if (!payload.Results?.[0]) throw new NhtsaError('NHTSA vPIC returned no decode result');
  return normalizeVpicResult(payload.Results[0], vin);
}

export async function decodeVins(
  vehicles: VinDecodeRequest[],
  options: { fetcher?: FetchLike; timeoutMs?: number } = {},
): Promise<Array<{ input: VinDecodeRequest; decoded: DecodedVehicle }>> {
  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    throw new NhtsaError('vehicles must be a non-empty array', 400);
  }
  if (vehicles.length > 500) {
    throw new NhtsaError('A maximum of 500 vehicles can be decoded per request', 400);
  }

  const normalized = vehicles.map((vehicle, index) => {
    const vin = normalizeVin(vehicle?.vin);
    if (!isValidVin(vin)) {
      throw new NhtsaError(`vehicles[${index}].vin must be 17 characters and cannot contain I, O, or Q`, 400);
    }
    return { ...vehicle, vin };
  });

  const output: Array<{ input: VinDecodeRequest; decoded: DecodedVehicle }> = [];
  for (let start = 0; start < normalized.length; start += VPIC_BATCH_SIZE) {
    const chunk = normalized.slice(start, start + VPIC_BATCH_SIZE);
    const data = chunk
      .map(({ vin, modelYear }) => `${vin},${modelYear === undefined ? '' : String(modelYear).trim()}`)
      .join(';');
    const body = new URLSearchParams({ DATA: data, format: 'json' });
    const payload = await fetchVpic(
      `${VPIC_BASE_URL}/DecodeVINValuesBatch/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
      options.fetcher ?? fetch,
      options.timeoutMs ?? 12_000,
    );
    if (payload.Results!.length !== chunk.length) {
      throw new NhtsaError('NHTSA vPIC returned an incomplete batch response');
    }
    chunk.forEach((input, index) => {
      output.push({ input, decoded: normalizeVpicResult(payload.Results![index], input.vin) });
    });
  }
  return output;
}
