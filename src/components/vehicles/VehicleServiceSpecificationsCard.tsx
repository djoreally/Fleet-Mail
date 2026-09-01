import React from 'react';

export interface VehicleServiceSpecificationsValue {
  oilType?: string | null;
  oilViscosity?: string | null;
  oilSpecification?: string | null;
  oilCapacityQuarts?: number | null;
  oilFilterPartNumber?: string | null;
  engineAirFilterPartNumber?: string | null;
  cabinAirFilterPartNumber?: string | null;
  fuelFilterPartNumber?: string | null;
  transmissionFluid?: string | null;
  coolantSpecification?: string | null;
  defRequired?: boolean | null;
  tireSize?: string | null;
  frontTirePsi?: number | null;
  rearTirePsi?: number | null;
  batterySpecification?: string | null;
  driverWiperSize?: string | null;
  passengerWiperSize?: string | null;
  rearWiperSize?: string | null;
  drainPlugTorqueFtLb?: number | null;
  wheelLugTorqueFtLb?: number | null;
  source?: string | null;
  sourceUpdatedAt?: string | null;
}

const display = (value: unknown, suffix = '') => value === null || value === undefined || value === '' ? '—' : `${String(value)}${suffix}`;

export function VehicleServiceSpecificationsCard({ specifications }: { specifications?: VehicleServiceSpecificationsValue | null }) {
  const s = specifications || {};
  const rows: Array<[string, string]> = [
    ['Oil', [s.oilViscosity, s.oilType, s.oilSpecification].filter(Boolean).join(' · ') || '—'],
    ['Oil capacity', display(s.oilCapacityQuarts, ' qt')],
    ['Oil filter', display(s.oilFilterPartNumber)],
    ['Engine air filter', display(s.engineAirFilterPartNumber)],
    ['Cabin air filter', display(s.cabinAirFilterPartNumber)],
    ['Fuel filter', display(s.fuelFilterPartNumber)],
    ['Transmission fluid', display(s.transmissionFluid)],
    ['Coolant', display(s.coolantSpecification)],
    ['DEF', s.defRequired === null || s.defRequired === undefined ? '—' : s.defRequired ? 'Required' : 'Not required'],
    ['Tires', [s.tireSize, s.frontTirePsi != null ? `Front ${s.frontTirePsi} PSI` : '', s.rearTirePsi != null ? `Rear ${s.rearTirePsi} PSI` : ''].filter(Boolean).join(' · ') || '—'],
    ['Battery', display(s.batterySpecification)],
    ['Wipers', [s.driverWiperSize && `Driver ${s.driverWiperSize}`, s.passengerWiperSize && `Passenger ${s.passengerWiperSize}`, s.rearWiperSize && `Rear ${s.rearWiperSize}`].filter(Boolean).join(' · ') || '—'],
    ['Drain plug torque', display(s.drainPlugTorqueFtLb, ' ft-lb')],
    ['Wheel lug torque', display(s.wheelLugTorqueFtLb, ' ft-lb')],
  ];
  return <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Technician service data</p><h4 className="mt-1 font-bold text-slate-950">Vehicle specifications</h4></div>{s.source&&<span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">{s.source}</span>}</div>
    <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">{rows.map(([label,value])=><div key={label}><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd></div>)}</dl>
  </section>;
}
