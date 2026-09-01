export interface VehicleServiceSpecifications {
  oilType: string | null;
  oilViscosity: string | null;
  oilSpecification: string | null;
  oilCapacityQuarts: number | null;
  oilFilterPartNumber: string | null;
  engineAirFilterPartNumber: string | null;
  cabinAirFilterPartNumber: string | null;
  fuelFilterPartNumber: string | null;
  transmissionFluid: string | null;
  coolantSpecification: string | null;
  defRequired: boolean | null;
  tireSize: string | null;
  frontTirePsi: number | null;
  rearTirePsi: number | null;
  batterySpecification: string | null;
  driverWiperSize: string | null;
  passengerWiperSize: string | null;
  rearWiperSize: string | null;
  drainPlugTorqueFtLb: number | null;
  wheelLugTorqueFtLb: number | null;
  source: string | null;
  sourceUpdatedAt: string | null;
}

const text = (value: unknown) => {
  const normalized = value == null ? '' : String(value).trim();
  return normalized || null;
};

const number = (value: unknown) => {
  if (value === '' || value == null) return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
};

const boolean = (value: unknown) => typeof value === 'boolean' ? value : value == null || value === '' ? null : String(value).toLowerCase() === 'true';

export function normalizeVehicleServiceSpecifications(value: unknown): VehicleServiceSpecifications {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    oilType: text(input.oilType),
    oilViscosity: text(input.oilViscosity),
    oilSpecification: text(input.oilSpecification),
    oilCapacityQuarts: number(input.oilCapacityQuarts),
    oilFilterPartNumber: text(input.oilFilterPartNumber),
    engineAirFilterPartNumber: text(input.engineAirFilterPartNumber),
    cabinAirFilterPartNumber: text(input.cabinAirFilterPartNumber),
    fuelFilterPartNumber: text(input.fuelFilterPartNumber),
    transmissionFluid: text(input.transmissionFluid),
    coolantSpecification: text(input.coolantSpecification),
    defRequired: boolean(input.defRequired),
    tireSize: text(input.tireSize),
    frontTirePsi: number(input.frontTirePsi),
    rearTirePsi: number(input.rearTirePsi),
    batterySpecification: text(input.batterySpecification),
    driverWiperSize: text(input.driverWiperSize),
    passengerWiperSize: text(input.passengerWiperSize),
    rearWiperSize: text(input.rearWiperSize),
    drainPlugTorqueFtLb: number(input.drainPlugTorqueFtLb),
    wheelLugTorqueFtLb: number(input.wheelLugTorqueFtLb),
    source: text(input.source),
    sourceUpdatedAt: text(input.sourceUpdatedAt),
  };
}

export function technicianVehicleSnapshot(vehicle: {
  id: string;
  unitNumber: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim?: string | null;
  engine: string | null;
  fuelType?: string | null;
  mileage: number | null;
  engineHours?: number | null;
  specifications?: unknown;
}) {
  return {
    id: vehicle.id,
    unitNumber: vehicle.unitNumber,
    vin: vehicle.vin,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim ?? null,
    engine: vehicle.engine,
    fuelType: vehicle.fuelType ?? null,
    mileage: vehicle.mileage,
    engineHours: vehicle.engineHours ?? null,
    serviceSpecifications: normalizeVehicleServiceSpecifications(vehicle.specifications),
  };
}
