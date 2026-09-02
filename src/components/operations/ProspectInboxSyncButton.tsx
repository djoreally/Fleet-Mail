import React, { useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { fleetFetch } from '../../lib/fleetApi';

export function ProspectInboxSyncButton(){
  const[working,setWorking]=useState(false);const[status,setStatus]=useState('');
  async function sync(){
    setWorking(true);setStatus('');
    try{
      const response=await fleetFetch('/api/operations/prospects/sync-inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:75})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`Sync failed (${response.status})`);
      setStatus(data.recorded?`${data.recorded} new prospect ${data.recorded===1?'reply':'replies'} linked`:'No new prospect replies');
      if(data.recorded)setTimeout(()=>window.location.reload(),500);
    }catch(error){setStatus(error instanceof Error?error.message:'Inbox sync failed')}finally{setWorking(false)}
  }
  return <div className="mx-5 mt-5 flex flex-wrap items-center justify-end gap-3 lg:mx-8"><span className="text-xs font-medium text-slate-500">{status}</span><button onClick={()=>void sync()} disabled={working} className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm disabled:opacity-50">{working?<Loader2 className="h-4 w-4 animate-spin"/>:<MailCheck className="h-4 w-4 text-emerald-600"/>}Sync prospect replies</button></div>;
}
