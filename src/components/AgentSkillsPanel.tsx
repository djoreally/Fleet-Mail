import React, { useEffect, useMemo, useState } from 'react';
import { Brain, CheckCircle2, Link2, LockKeyhole, ShieldCheck, Zap } from 'lucide-react';

type Skill = {
  id: string;
  name: string;
  category: 'Cognitive' | 'Execution' | 'Information' | 'Trust & Safety';
  description: string;
  status: 'active' | 'connected' | 'guarded';
  confirmationRequired?: boolean;
};

const icons = { Cognitive: Brain, Execution: Zap, Information: Link2, 'Trust & Safety': ShieldCheck };

export function AgentSkillsPanel() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [meta, setMeta] = useState({ model: '', provider: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/agent/skills')
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not load agent skills');
        if (active) { setSkills(body.skills || []); setMeta({ model: body.model || '', provider: body.provider || '' }); }
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Could not load agent skills'));
    return () => { active = false; };
  }, []);

  const groups = useMemo(() => Object.entries(skills.reduce<Record<string, Skill[]>>((all, skill) => {
    (all[skill.category] ||= []).push(skill); return all;
  }, {})), [skills]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Agent capabilities">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Live capabilities</p><h3 className="mt-1 text-lg font-bold text-slate-900">Fleet OS Agent Skills</h3><p className="mt-1 text-xs text-slate-500">{meta.provider && `${meta.provider} · ${meta.model}`}</p></div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Connected</span>
      </div>
      {error ? <p className="p-5 text-sm text-red-600">{error}</p> : (
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          {groups.map(([category, items]) => {
            const Icon = icons[category as keyof typeof icons] || Brain;
            return <div key={category}><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Icon className="h-4 w-4" />{category}</div><div className="space-y-2">{items.map((skill) => <div key={skill.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{skill.name}</p><span className="text-[10px] font-bold uppercase text-slate-500">{skill.status}</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{skill.description}</p>{skill.confirmationRequired && <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700"><LockKeyhole className="h-3 w-3" />Requires confirmation</p>}</div>)}</div></div>;
          })}
        </div>
      )}
    </section>
  );
}
