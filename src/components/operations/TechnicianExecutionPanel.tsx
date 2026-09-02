import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ClipboardCheck, Loader2, Plus, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { fleetFetch } from '../../lib/fleetApi';
import { operationsApi, type PartRow } from './operationsApi';

type Row = Record<string, any>;
type Execution = {
  workOrder: Row;
  inspections: Array<Row & { items: Row[] }>;
  authorizations: Row[];
  serviceLines: Row[];
  partUsage: Row[];
  fluidUsage: Row[];
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fleetFetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

const field = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50';
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function TechnicianExecutionPanel({ workOrderId, onChanged }: { workOrderId: string; onChanged?: () => void }) {
  const [execution, setExecution] = useState<Execution | null>(null);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [result, catalog] = await Promise.all([
               request<{ execution: Execution }>(`/api/operations/work-orders/${workOrderId}/execution`),
        operationsApi.parts('').catch(() => ({ parts: [] as PartRow[] })),
      ]);
      setExecution(result.execution);
      setParts(catalog.parts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load technician execution');
    }
  }, [workOrderId]);

  useEffect(() => { void load(); }, [load]);

  const mutate = async (key: string, url: string, body?: Record<string, unknown>) => {
    setBusy(key); setError('');
    try {
      await request(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      await load();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Technician action failed');
    } finally { setBusy(''); }
  };

  if (!execution) return <section className="rounded-2xl border p-5">{error ? <p className="text-sm text-red-700">{error}</p> : <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading execution…</p>}</section>;

  const activeInspection = execution.inspections.find((item) => item.status !== 'complete');
  const completeInspection = execution.inspections.find((item) => item.status === 'complete');
  const pendingAuthorization = execution.authorizations.find((item) => item.status === 'pending');
  const unresolvedLines = execution.serviceLines.filter((item) => item.authorized && !item.completedAt);
  const canComplete = Boolean(completeInspection) && !activeInspection && !pendingAuthorization && unresolvedLines.length === 0 &&
    execution.serviceLines.every((item) => item.authorized || item.completedAt);

  const submit = (handler: (values: Record<string, string>) => Promise<void>) => async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handler(Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>);
    event.currentTarget.reset();
  };

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Technician execution</p><h4 className="mt-1 text-base font-bold">{label(execution.workOrder.status)}</h4></div>
      <button onClick={() => void load()} aria-label="Refresh technician execution" className="grid h-11 w-11 place-items-center rounded-xl border bg-white"><RefreshCw className="h-4 w-4"/></button>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

    {!activeInspection && !completeInspection && <form onSubmit={submit(async (values) => mutate('inspection', `/api/operations/work-orders/${workOrderId}/inspections`, values))} className="rounded-2xl border bg-white p-4">
      <h5 className="flex items-center gap-2 font-bold"><ClipboardCheck className="h-4 w-4 text-blue-600"/>Start inspection</h5>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><input name="odometer" inputMode="numeric" placeholder="Odometer" className={field}/><input name="engineHours" inputMode="decimal" placeholder="Engine hours" className={field}/></div>
      <button disabled={Boolean(busy)} className={`${button} mt-3 w-full bg-blue-600 text-white`}>{busy === 'inspection' && <Loader2 className="h-4 w-4 animate-spin"/>Begin inspection</button>
    </form>}

    {execution.inspections.map((inspection) => <div key={inspection.id} className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between"><h5 className="font-bold">Inspection</h5><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{label(inspection.status)}</span></div>
      <div className="mt-3 space-y-2">{inspection.items.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3">
        <div className="flex justify-between gap-3"><b className="text-sm">{item.name}</b><span className="text-xs font-bold">{label(item.condition)}</span></div>
        {item.measurement && <p className="mt-1 text-xs text-slate-600">Measurement: {item.measurement}</p>}
        {item.recommendation && <p className="mt-2 text-sm text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5"/>{item.recommendation}{item.severity ? ` · ${label(item.severity)}` : ''}</p>}
        {Array.isArray(item.photos) && item.photos.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{item.photos.map((photo: string) => <a key={photo} href={photo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"><Camera className="h-3 w-3"/>Photo</a>)}</div>}
      </div>)}</div>
      {inspection.status !== 'complete' && <>
        <form onSubmit={submit(async (values) => mutate('item', `/api/operations/inspections/${inspection.id}/items`, { ...values, photos: values.photos ? values.photos.split(',').map((value) => value.trim()).filter(Boolean) : [] }))} className="mt-4 grid gap-3">
          <input required name="name" placeholder="Inspection item — e.g. Front brake pads" className={field}/>
          <div className="grid gap-3 sm:grid-cols-3"><select required name="condition" className={field}><option value="">Condition…</option><option value="good">Good</option><option value="attention">Attention</option><option value="failed">Failed</option></select><input name="measurement" placeholder="Measurement" className={field}/><select name="severity" className={field}><option value="">Severity…</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="safety">Safety</option></select></div>
          <textarea name="recommendation" placeholder="Recommendation" className="min-h-20 rounded-xl border p-3 text-sm"/>
          <input name="photos" placeholder="Photo URLs, separated by commas" aria-label="Inspection photo URLs" className={field}/>
          <button disabled={Boolean(busy)} className={`${button} border bg-white`}><Plus className="h-4 w-4"/>Add inspection item</button>
        </form>
        <button onClick={() => void mutate('complete-inspection', `/api/operations/inspections/${inspection.id}/complete`)} disabled={Boolean(busy) || inspection.items.length === 0} className={`${button} mt-3 w-full bg-slate-900 text-white`}><CheckCircle2 className="h-4 w-4"/>Complete inspection</button>
      </>}
    </div>)}

    <div className="rounded-2xl border bg-white p-4">
      <h5 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-blue-600"/>Authorization</h5>
      <div className="mt-3 space-y-2">{execution.authorizations.map((authorization) => <div key={authorization.id} className="rounded-xl bg-slate-50 p-3">
        <div className="flex items-center justify-between"><span className="text-sm font-semibold">{authorization.amount ? `$${Number(authorization.amount).toFixed(2)}` : 'Authorization request'}</span><b className="text-xs">{label(authorization.status)}</b></div>
        {authorization.status === 'pending' && <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => window.confirm('Confirm customer authorization?') && void mutate('authorize', `/api/operations/authorizations/${authorization.id}/decision`, { decision: 'authorized', authorizationMethod: 'technician_app' })} className={`${button} bg-emerald-600 text-white`}>Authorize</button><button onClick={() => window.confirm('Reject this authorization?') && void mutate('reject', `/api/operations/authorizations/${authorization.id}/decision`, { decision: 'rejected', authorizationMethod: 'technician_app' })} className={`${button} border text-red-700`}>Reject</button></div>}
      </div>)}</div>
      {completeInspection && !pendingAuthorization && <form onSubmit={submit(async (values) => mutate('authorization', `/api/operations/work-orders/${workOrderId}/authorizations`, values))} className="mt-3 grid gap-3 sm:grid-cols-2"><input name="amount" type="number" min="0" step=".01" placeholder="Amount" className={field}/><input name="purchaseOrderNumber" placeholder="PO number" className={field}/><textarea name="notes" placeholder="Authorization notes" className="min-h-20 rounded-xl border p-3 text-sm sm:col-span-2"/><button className={`${button} border bg-white sm:col-span-2`}><Plus className="h-4 w-4"/>Request authorization</button></form>}
    </div>

    <div className="rounded-2xl border bg-white p-4">
      <h5 className="flex items-center gap-2 font-bold"><Wrench className="h-4 w-4 text-blue-600"/>Service execution</h5>
      <div className="mt-3 space-y-2">{execution.serviceLines.map((line) => <div key={line.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><b className="text-sm">{line.description}</b><p className="text-xs text-slate-500">{line.authorized ? 'Authorized' : 'Not authorized'}{line.completedAt ? ' · Completed' : ''}</p></div>{line.authorized && !line.completedAt && <button onClick={() => void mutate('line', `/api/operations/service-lines/${line.id}/complete`)} className={`${button} bg-blue-600 text-white`}>Complete</button>}</div>)}</div>
      <form onSubmit={submit(async (values) => mutate('service-line', `/api/operations/work-orders/${workOrderId}/service-lines`, { ...values, authorized: values.authorized === 'on' }))} className="mt-3 grid gap-3 sm:grid-cols-2"><input required name="description" placeholder="Service performed / recommended" className={field}/><select name="kind" className={field}><option value="labor">Labor</option><option value="part">Part</option><option value="fluid">Fluid</option></select><input name="laborMinutes" type="number" min="0" placeholder="Labor minutes" className={field}/><input name="unitPrice" type="number" min="0" step=".01" placeholder="Unit price" className={field}/><label className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm sm:col-span-2"><input name="authorized" type="checkbox"/>Customer already authorized this line</label><button className={`${button} border bg-white sm:col-span-2`}><Plus className="h-4 w-4"/>Add service line</button></form>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={submit(async (values) => mutate('part', `/api/operations/work-orders/${workOrderId}/parts`, values))} className="rounded-2xl border bg-white p-4"><h5 className="font-bold">Parts used</h5><select required name="partId" className={`${field} mt-3`}><option value="">Select inventory part…</option>{parts.map((part) => <option key={part.id} value={part.id}>{part.sku} · {part.name}</option>)}</select><div className="mt-3 grid grid-cols-2 gap-3"><input required name="quantity" type="number" min=".001" step=".001" placeholder="Quantity" className={field}/><input name="sellPrice" type="number" min="0" step=".01" placeholder="Sell price" className={field}/></div><button className={`${button} mt-3 w-full border bg-white`}><Plus className="h-4 w-4"/>Record part</button><p className="mt-3 text-xs text-slate-500">{execution.partUsage.length} usage record(s)</p></form>
      <form onSubmit={submit(async (values) => mutate('fluid', `/api/operations/work-orders/${workOrderId}/fluids`, values))} className="rounded-2xl border bg-white p-4"><h5 className="font-bold">Fluids used</h5><input required name="name" placeholder="Fluid name" className={`${field} mt-3`}/><div className="mt-3 grid grid-cols-2 gap-3"><input name="specification" placeholder="Specification" className={field}/><input name="viscosity" placeholder="Viscosity" className={field}/><input required name="quantity" type="number" min=".001" step=".001" placeholder="Quantity" className={field}/><input name="sellPrice" type="number" min="0" step=".01" placeholder="Sell price" className={field}/></div><button className={`${button} mt-3 w-full border bg-white`}><Plus className="h-4 w-4"/>Record fluid</button><p className="mt-3 text-xs text-slate-500">{execution.fluidUsage.length} usage record(s)</p></form>
    </div>

    <div className={`rounded-2xl border p-4 ${canComplete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <h5 className="font-bold">Completion gate</h5>
      <ul className="mt-2 space-y-1 text-xs"><li>{completeInspection && !activeInspection ? '✓' : '○'} Completed inspection</li><li>{pendingAuthorization ? '○' : '✓'} No pending authorization</li><li>{unresolvedLines.length === 0 ? '✓' : '○'} Authorized service lines completed</li></ul>
      <button disabled={!canComplete || Boolean(busy)} onClick={() => window.confirm('Complete and close this work order?') && void mutate('complete-work-order', `/api/operations/work-orders/${workOrderId}/complete-validated`)} className={`${button} mt-3 w-full bg-emerald-700 text-white`}><CheckCircle2 className="h-4 w-4"/>Complete work order</button>
    </div>
  </section>;
}
