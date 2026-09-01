import { describe, expect, it } from 'vitest';
import { normalizeVehicleServiceSpecifications, technicianVehicleSnapshot } from './vehicleSpecifications.js';

describe('vehicle service specifications', () => {
  it('normalizes technician-critical vehicle service data', () => {
    const result = normalizeVehicleServiceSpecifications({
      oilType: 'Full Synthetic',
      oilViscosity: '5W-30',
      oilCapacityQuarts: '12.5',
      oilFilterPartNumber: 'FL-500S',
      engineAirFilterPartNumber: 'FA-1912',
      cabinAirFilterPartNumber: 'FP-92',
      defRequired: true,
      frontTirePsi: '55',
      rearTirePsi: 70,
    });
    expect(result.oilType).toBe('Full Synthetic');
    expect(result.oilViscosity).toBe('5W-30');
    expect(result.oilCapacityQuarts).toBe(12.5);
    expect(result.oilFilterPartNumber).toBe('FL-500S');
    expect(result.engineAirFilterPartNumber).toBe('FA-1912');
    expect(result.cabinAirFilterPartNumber).toBe('FP-92');
    expect(result.defRequired).toBe(true);
    expect(result.frontTirePsi).toBe(55);
    expect(result.rearTirePsi).toBe(70);
  });

  it('packages service specifications with the technician vehicle snapshot', () => {
    const snapshot = technicianVehicleSnapshot({
      id: 'veh-1', unitNumber: '218', vin: '1FTBW1XG5MKA12345', year: 2024,
      make: 'Ford', model: 'Transit', trim: '250', engine: '3.5L', fuelType: 'Gas',
      mileage: 42100, engineHours: 1880,
      specifications: { oilViscosity: '5W-30', oilCapacityQuarts: 12, oilFilterPartNumber: 'FL-500S' },
    });
    expect(snapshot.unitNumber).toBe('218');
    expect(snapshot.serviceSpecifications.oilViscosity).toBe('5W-30');
    expect(snapshot.serviceSpecifications.oilCapacityQuarts).toBe(12);
    expect(snapshot.serviceSpecifications.oilFilterPartNumber).toBe('FL-500S');
  });
});
