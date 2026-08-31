import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  X
} from 'lucide-react';

type VehicleStatus = 'Active' | 'In service' | 'Out of service';

interface Vehicle {
  id: string;
  unit: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  trim?: string;
  type: string;
  mileage: string;
  assignment: string;
  status: VehicleStatus;
}

interface VehicleDraft {
  unit: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  type: string;
  mileage: string;
  assignment: string;
}

interface ImportRow extends VehicleDraft {
  row: number;
  status: 'ready' | 'decoding' | 'error';
  message?: string;
}

interface DecodeResult {
  vin?: string;
  valid?: boolean;
  error?: string;
  message?: string;
  year?: string | number;
  modelYear?: string | number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  vehicleType?: string | null;
  type?: string | null;
  errorText?: string | null;
}

export interface VehicleWorkspaceProps {
  onVehicleAdded?: (vehicle: VehicleDraft) => void;
  onVehiclesImported?: (vehicles: VehicleDraft[]) => void;
}

const initialVehicles: Vehicle[] = [
  { id: 'v1', unit: 'TRK-104', vin: '1FTFW1E89PFA10452', year: '2023', make: 'Ford', model: 'F-150', trim: 'XL', type: 'Pickup', mileage: '38,412', assignment: 'North District', status: 'Active' },
  { id: 'v2', unit: 'VAN-218', vin: '1GCWGAFP8P1157834', year: '2023', make: 'Chevrolet', model: 'Express', trim: '2500', type: 'Cargo van', mileage: '46,890', assignment: 'Mobile Service 2', status: 'In service' },
  { id: 'v3', unit: 'TRK-087', vin: '3C6UR5CL7NG241907', year: '2022', make: 'Ram', model: '2500', trim: 'Tradesman', type: 'Pickup', mileage: '71,204', assignment: 'West District', status: 'Active' },
  { id: 'v4', unit: 'SUV-031', vin: '1FM5K8GC8NGA31948', year: '2022', make: 'Ford', model: 'Explorer', trim: 'ST', type: 'SUV', mileage: '54,620', assignment: 'Operations', status: 'Out of service' },
  { id: 'v5', unit: 'VAN-191', vin: '2C4JRGAG5PR508122', year: '2023', make: 'Chrysler', model: 'Voyager', trim: 'LX', type: 'Van', mileage: '29,104', assignment: 'South District', status: 'Active' }
];

const emptyDraft: VehicleDraft = { unit: '', vin: '', year: '', make: '', model: '', trim: '', type: '', mileage: '', assignment: '' };
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

const cleanVin = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);

const toDraft = (result: DecodeResult, current: VehicleDraft): VehicleDraft => ({
  ...current,
  vin: cleanVin(result.vin || current.vin),
  year: result.modelYear || result.year ? String(result.modelYear || result.year) : current.year,
  make: result.make || current.make,
  model: result.model || current.model,
  trim: result.trim || current.trim,
  type: result.vehicleType || result.type || current.type
});

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = '';
    } else field += character;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const statusStyle: Record<VehicleStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'In service': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Out of service': 'bg-rose-50 text-rose-700 ring-rose-600/20'
};

export const VehicleWorkspace: React.FC<VehicleWorkspaceProps> = ({ onVehicleAdded, onVehiclesImported }) => {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'add' | 'import' | null>(null);
  const [draft, setDraft] = useState<VehicleDraft>(emptyDraft);
  const [decodeState, setDecodeState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [decodeMessage, setDecodeMessage] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const filteredVehicles = useMemo(() => {
    const term = query.toLowerCase();
    return vehicles.filter(vehicle => [vehicle.unit, vehicle.vin, vehicle.make, vehicle.model, vehicle.assignment].some(value => value.toLowerCase().includes(term)));
  }, [query, vehicles]);

  const updateDraft = (field: keyof VehicleDraft, value: string) => {
    setDraft(current => ({ ...current, [field]: field === 'vin' ? cleanVin(value) : value }));
    if (field === 'vin') { setDecodeState('idle'); setDecodeMessage(''); }
  };

  const decodeVin = async () => {
    if (!VIN_PATTERN.test(draft.vin)) { setDecodeState('error'); setDecodeMessage('Enter a valid 17-character VIN. Letters I, O, and Q are not used.'); return; }
    setDecodeState('loading'); setDecodeMessage('');
    try {
      const response = await fetch('/api/vehicles/decode-vin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: draft.vin, modelYear: draft.year || undefined })
      });
      const payload = await response.json() as { decoded?: DecodeResult; error?: string };
      const decoded = payload.decoded;
      if (!response.ok || !decoded || decoded.valid === false || payload.error) throw new Error(payload.error || decoded?.errorText || 'VIN could not be decoded.');
      setDraft(current => toDraft(decoded, current));
      setDecodeState('success'); setDecodeMessage('Decoded by NHTSA. You can edit any field before saving.');
    } catch (error) {
      setDecodeState('error'); setDecodeMessage(error instanceof Error ? error.message : 'VIN could not be decoded.');
    }
  };

  const saveVehicle = () => {
    if (!draft.unit || !VIN_PATTERN.test(draft.vin) || !draft.make || !draft.model) return;
    const vehicle: Vehicle = { id: `v-${Date.now()}`, ...draft, status: 'Active', mileage: draft.mileage || '0' };
    setVehicles(current => [vehicle, ...current]);
    onVehicleAdded?.(draft);
    closeModal();
  };

  const closeModal = () => { setModal(null); setDraft(emptyDraft); setDecodeState('idle'); setDecodeMessage(''); setImportRows([]); setImporting(false); };

  const loadCsv = async (file: File) => {
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) { setImportRows([]); return; }
    const headers = parsed[0].map(header => header.toLowerCase().replace(/[ _-]/g, ''));
    const value = (row: string[], name: string) => row[headers.indexOf(name)] || '';
    const rows: ImportRow[] = parsed.slice(1).map((row, index) => {
      const vin = cleanVin(value(row, 'vin'));
      return {
        row: index + 2, unit: value(row, 'unit') || value(row, 'unitnumber'), vin,
        year: value(row, 'year'), make: value(row, 'make'), model: value(row, 'model'), trim: value(row, 'trim'),
        type: value(row, 'type') || value(row, 'vehicletype'), mileage: value(row, 'mileage'), assignment: value(row, 'assignment'),
        status: VIN_PATTERN.test(vin) ? 'decoding' : 'error', message: VIN_PATTERN.test(vin) ? undefined : 'Invalid VIN'
      };
    });
    setImportRows(rows);
    const valid = rows.filter(row => row.status !== 'error');
    if (!valid.length) return;
    try {
      const response = await fetch('/api/vehicles/decode-vins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicles: valid.map(row => ({ vin: row.vin, modelYear: row.year || undefined, row: row.row })) })
      });
      if (!response.ok) throw new Error('Batch decode failed');
      const payload = await response.json() as { results?: Array<{ input: { vin?: string; row?: number }; decoded: DecodeResult }> };
      const results = payload.results || [];
      setImportRows(current => current.map(row => {
        if (row.status === 'error') return row;
        const result = results.find(item => item.input.row === row.row || cleanVin(item.input.vin || '') === row.vin)?.decoded;
        if (!result || result.valid === false || result.error) return { ...row, status: 'error', message: result?.error || result?.errorText || 'Decode failed' };
        return { ...toDraft(result, row), row: row.row, status: 'ready' };
      }));
    } catch {
      setImportRows(current => current.map(row => row.status === 'decoding' ? { ...row, status: 'error', message: 'Decode service unavailable' } : row));
    }
  };

  const finishImport = async () => {
    const ready = importRows.filter(row => row.status === 'ready');
    if (!ready.length) return;
    setImporting(true);
    const drafts = ready.map(({ row: _row, status: _status, message: _message, ...vehicle }) => vehicle);
    setVehicles(current => [...drafts.map((vehicle, index): Vehicle => ({ ...vehicle, id: `import-${Date.now()}-${index}`, status: 'Active', mileage: vehicle.mileage || '0' })), ...current]);
    onVehiclesImported?.(drafts);
    closeModal();
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">Fleet registry</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Vehicles</h1><p className="mt-2 text-sm text-slate-500">Every unit, assignment, and service status in one place.</p></div>
          <div className="flex gap-2">
            <button onClick={() => setModal('import')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><Upload className="h-4 w-4" />Import CSV</button>
            <button onClick={() => setModal('add')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus className="h-4 w-4" />Add vehicle</button>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[['Total vehicles', vehicles.length, 'text-slate-950'], ['Available', vehicles.filter(v => v.status === 'Active').length, 'text-emerald-600'], ['In service', vehicles.filter(v => v.status === 'In service').length, 'text-amber-600'], ['Out of service', vehicles.filter(v => v.status === 'Out of service').length, 'text-rose-600']].map(([label, count, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{count}</p></div>)}
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search unit, VIN, vehicle…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600">All statuses <ChevronDown className="h-4 w-4" /></button>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr>{['Unit','Vehicle','VIN','Mileage','Assignment','Status',''].map(value => <th key={value} className="px-5 py-3">{value}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredVehicles.map(vehicle => <tr key={vehicle.id} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-bold text-slate-900">{vehicle.unit}</td><td className="px-5 py-4"><p className="font-semibold text-slate-800">{vehicle.year} {vehicle.make} {vehicle.model}</p><p className="text-xs text-slate-400">{vehicle.trim} · {vehicle.type}</p></td><td className="px-5 py-4 font-mono text-xs text-slate-500">{vehicle.vin}</td><td className="px-5 py-4 font-medium text-slate-700">{vehicle.mileage} mi</td><td className="px-5 py-4 text-slate-600">{vehicle.assignment}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle[vehicle.status]}`}>{vehicle.status}</span></td><td className="px-5 py-4"><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><MoreHorizontal className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing {filteredVehicles.length} of {vehicles.length} vehicles</div>
        </section>
      </div>

      {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}>
        <div className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${modal === 'import' ? 'max-w-4xl' : 'max-w-2xl'}`}>
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5"><div><h2 className="text-xl font-bold text-slate-950">{modal === 'add' ? 'Add a vehicle' : 'Import fleet vehicles'}</h2><p className="mt-1 text-sm text-slate-500">{modal === 'add' ? 'Decode a VIN with NHTSA, then review the details.' : 'Upload a CSV and review every VIN before importing.'}</p></div><button onClick={closeModal} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          {modal === 'add' ? <div className="p-6">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Vehicle identification number</label>
            <div className="mt-2 flex gap-2"><input value={draft.vin} onChange={event => updateDraft('vin', event.target.value)} placeholder="Enter 17-character VIN" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-3 font-mono text-sm uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><button onClick={decodeVin} disabled={decodeState === 'loading'} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">{decodeState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Decode</button></div>
            <p className="mt-2 text-xs text-slate-400">{draft.vin.length}/17 characters · Uses the U.S. Department of Transportation NHTSA vPIC service.</p>
            {decodeState !== 'idle' && decodeState !== 'loading' && <div className={`mt-4 flex gap-3 rounded-xl p-3 text-sm ${decodeState === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{decodeState === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}<span>{decodeMessage}</span></div>}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Field label="Unit number *" value={draft.unit} onChange={value => updateDraft('unit', value)} placeholder="TRK-105" />
              <Field label="Year" value={draft.year} onChange={value => updateDraft('year', value)} placeholder="2024" />
              <Field label="Make *" value={draft.make} onChange={value => updateDraft('make', value)} placeholder="Ford" />
              <Field label="Model *" value={draft.model} onChange={value => updateDraft('model', value)} placeholder="F-150" />
              <Field label="Trim" value={draft.trim} onChange={value => updateDraft('trim', value)} placeholder="XL" />
              <Field label="Vehicle type" value={draft.type} onChange={value => updateDraft('type', value)} placeholder="Pickup" />
              <Field label="Current mileage" value={draft.mileage} onChange={value => updateDraft('mileage', value)} placeholder="0" />
              <Field label="Assignment" value={draft.assignment} onChange={value => updateDraft('assignment', value)} placeholder="North District" />
            </div>
            <div className="mt-7 flex justify-end gap-2"><button onClick={closeModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button onClick={saveVehicle} disabled={!draft.unit || !VIN_PATTERN.test(draft.vin) || !draft.make || !draft.model} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Add vehicle</button></div>
          </div> : <div className="p-6">
            {!importRows.length ? <button onClick={() => fileInput.current?.click()} className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 px-6 py-12 text-center hover:border-blue-300 hover:bg-blue-50/30"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><FileSpreadsheet className="h-6 w-6" /></span><span className="mt-4 font-bold text-slate-900">Choose a CSV file</span><span className="mt-1 text-sm text-slate-500">Required columns: unit, vin. Optional: mileage, assignment.</span><span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Upload className="h-4 w-4" />Browse files</span></button> : <>
              <div className="flex items-center justify-between"><div><p className="font-bold text-slate-900">Validation preview</p><p className="text-sm text-slate-500">{importRows.filter(row => row.status === 'ready').length} ready · {importRows.filter(row => row.status === 'error').length} need attention</p></div><button onClick={() => { setImportRows([]); fileInput.current?.click(); }} className="text-sm font-semibold text-blue-600">Choose another file</button></div>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200"><div className="max-h-80 overflow-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">VIN</th><th className="px-4 py-3">Decoded vehicle</th><th className="px-4 py-3">Result</th></tr></thead><tbody className="divide-y divide-slate-100">{importRows.map(row => <tr key={row.row}><td className="px-4 py-3 text-slate-400">{row.row}</td><td className="px-4 py-3 font-semibold text-slate-800">{row.unit || '—'}</td><td className="px-4 py-3 font-mono text-xs text-slate-600">{row.vin || '—'}</td><td className="px-4 py-3 text-slate-600">{row.make || row.model ? `${row.year} ${row.make} ${row.model}` : '—'}</td><td className="px-4 py-3">{row.status === 'decoding' ? <span className="inline-flex items-center gap-1.5 text-amber-600"><Loader2 className="h-3.5 w-3.5 animate-spin" />Decoding</span> : row.status === 'ready' ? <span className="inline-flex items-center gap-1.5 text-emerald-600"><Check className="h-3.5 w-3.5" />Ready</span> : <span className="inline-flex items-center gap-1.5 text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{row.message}</span>}</td></tr>)}</tbody></table></div></div>
              <div className="mt-6 flex justify-end gap-2"><button onClick={closeModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button onClick={finishImport} disabled={importing || !importRows.some(row => row.status === 'ready')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{importing && <Loader2 className="h-4 w-4 animate-spin" />}Import {importRows.filter(row => row.status === 'ready').length} vehicles</button></div>
            </>}
            <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={event => { const file = event.target.files?.[0]; if (file) void loadCsv(file); event.target.value = ''; }} />
            <a href="data:text/csv;charset=utf-8,unit%2Cvin%2Cmileage%2Cassignment%0ATRK-105%2C1FTFW1E89PFA10452%2C12000%2CNorth%20District" download="fleet-vehicles-template.csv" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600"><Download className="h-3.5 w-3.5" />Download CSV template</a>
          </div>}
        </div>
      </div>}
    </main>
  );
};

const Field: React.FC<{ label: string; value: string; placeholder?: string; onChange: (value: string) => void }> = ({ label, value, placeholder, onChange }) => <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>;

export default VehicleWorkspace;
