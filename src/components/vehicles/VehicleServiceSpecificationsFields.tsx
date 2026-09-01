import React from 'react';
import type { VehicleServiceSpecificationsValue } from './VehicleServiceSpecificationsCard';

type Props = { value: VehicleServiceSpecificationsValue; onChange: (value: VehicleServiceSpecificationsValue) => void };
const fields: Array<[keyof VehicleServiceSpecificationsValue,string,string]> = [
  ['oilViscosity','Oil viscosity','0W-20'],['oilType','Oil type','Full synthetic'],['oilSpecification','Oil specification','OEM / API spec'],['oilCapacityQuarts','Oil capacity (qt)','7.5'],
  ['oilFilterPartNumber','Oil filter','Part number'],['engineAirFilterPartNumber','Engine air filter','Part number'],['cabinAirFilterPartNumber','Cabin air filter','Part number'],['fuelFilterPartNumber','Fuel filter','Part number'],
  ['transmissionFluid','Transmission fluid','Specification'],['coolantSpecification','Coolant','Specification'],['tireSize','Tire size','235/65R16'],['frontTirePsi','Front PSI','55'],['rearTirePsi','Rear PSI','70'],
  ['batterySpecification','Battery','Group / specification'],['driverWiperSize','Driver wiper','24 in'],['passengerWiperSize','Passenger wiper','20 in'],['rearWiperSize','Rear wiper','14 in'],
  ['drainPlugTorqueFtLb','Drain plug torque','24'],['wheelLugTorqueFtLb','Wheel lug torque','100'],['source','Specification source','OEM manual / provider'],
];
const numeric = new Set<keyof VehicleServiceSpecificationsValue>(['oilCapacityQuarts','frontTirePsi','rearTirePsi','drainPlugTorqueFtLb','wheelLugTorqueFtLb']);

export function VehicleServiceSpecificationsFields({value,onChange}:Props){
  const set=(key:keyof VehicleServiceSpecificationsValue,raw:string)=>onChange({...value,[key]:numeric.has(key)?(raw===''?null:Number(raw)):raw||null,sourceUpdatedAt:new Date().toISOString()});
  return <section className="col-span-2 mt-2 rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Service specifications</p><p className="mt-1 text-xs text-slate-500">Saved with this vehicle and passed to the technician with every work order.</p></div><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{fields.map(([key,label,placeholder])=><label key={String(key)}><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span><input value={value[key] == null ? '' : String(value[key])} onChange={e=>set(key,e.target.value)} placeholder={placeholder} inputMode={numeric.has(key)?'decimal':undefined} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>)}<label><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">DEF requirement</span><select value={value.defRequired==null?'':String(value.defRequired)} onChange={e=>onChange({...value,defRequired:e.target.value===''?null:e.target.value==='true',sourceUpdatedAt:new Date().toISOString()})} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Unknown</option><option value="true">Required</option><option value="false">Not required</option></select></label></div></section>;
}
