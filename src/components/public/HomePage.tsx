import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  Mail,
  MapPinned,
  Menu,
  ScanLine,
  ShieldCheck,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

const capabilities = [
  { icon: MapPinned, title: 'Live dispatch', copy: 'Assign drivers, balance routes, and spot delays before they become missed commitments.', color: 'text-cyan-300 bg-cyan-300/10' },
  { icon: Wrench, title: 'Maintenance control', copy: 'Turn odometer and service data into preventive work your shop can actually stay ahead of.', color: 'text-amber-300 bg-amber-300/10' },
  { icon: CircleDollarSign, title: 'Invoices that follow the work', copy: 'Move completed jobs into clear, traceable invoices without rebuilding the story in another tool.', color: 'text-emerald-300 bg-emerald-300/10' },
  { icon: Mail, title: 'Operations inbox', copy: 'Keep customer, driver, and vendor conversations connected to the work they belong to.', color: 'text-violet-300 bg-violet-300/10' },
  { icon: ScanLine, title: 'Instant VIN intelligence', copy: 'Decode NHTSA vehicle records during manual entry or bulk import, with issues surfaced before save.', color: 'text-sky-300 bg-sky-300/10' },
  { icon: ShieldCheck, title: 'Tenant isolation', copy: 'Give every fleet its own secure workspace, scoped communications, and clean operating boundaries.', color: 'text-teal-300 bg-teal-300/10' },
];

export function HomePage({ onNavigate }: HomePageProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="min-h-screen overflow-hidden bg-[#07101f] text-white selection:bg-cyan-300 selection:text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07101f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <button onClick={() => onNavigate('/')} className="flex items-center gap-3" aria-label="Fleet OS home">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-400 text-slate-950"><Truck className="h-5 w-5" strokeWidth={2.4} /></span>
            <span className="text-base font-semibold tracking-tight">Fleet OS</span>
          </button>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#platform" className="text-sm text-slate-400 transition hover:text-white">Platform</a>
            <a href="#workflow" className="text-sm text-slate-400 transition hover:text-white">How it works</a>
            <a href="#security" className="text-sm text-slate-400 transition hover:text-white">Security</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={() => onNavigate('/sign-in')} className="px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white">Sign in</button>
            <button onClick={() => onNavigate('/sign-up')} className="rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">Start free</button>
          </div>
          <button onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 md:hidden" aria-label="Toggle navigation">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/10 bg-[#07101f] px-5 py-5 md:hidden">
            <div className="grid gap-2">
              {['Platform', 'How it works', 'Security'].map((label) => <a key={label} href={`#${label === 'Platform' ? 'platform' : label === 'Security' ? 'security' : 'workflow'}`} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5">{label}</a>)}
              <div className="mt-3 grid grid-cols-2 gap-3"><button onClick={() => onNavigate('/sign-in')} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm">Sign in</button><button onClick={() => onNavigate('/sign-up')} className="rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950">Start free</button></div>
            </div>
          </div>
        )}
      </header>

      <section className="relative px-5 pb-24 pt-36 sm:px-8 sm:pt-44 lg:px-10 lg:pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_2%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_10%_70%,rgba(20,184,166,0.1),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-medium text-cyan-200"><Gauge className="h-3.5 w-3.5" /> One command center for the entire operation</div>
            <h1 className="mt-7 text-5xl font-semibold leading-[1.01] tracking-[-0.055em] sm:text-6xl lg:text-7xl">Run your fleet with fewer gaps and faster decisions.</h1>
            <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">Fleet OS connects dispatch, vehicles, maintenance, communications, scheduling, and invoicing—so your team always knows what is happening next.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={() => onNavigate('/sign-up')} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-500/15 transition hover:bg-cyan-300 sm:w-auto">Start your workspace <ArrowRight className="h-4 w-4" /></button>
              <button onClick={() => onNavigate('/sign-in')} className="flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-6 text-sm font-medium text-white transition hover:bg-white/[0.07] sm:w-auto">Open Fleet OS</button>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-500">{['No card required', 'Secure tenant workspaces', 'Fast guided setup'].map((item) => <span key={item} className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-teal-300" />{item}</span>)}</div>
          </div>

          <div className="relative mx-auto mt-16 max-w-6xl rounded-[28px] border border-white/10 bg-[#0b1628] p-2 shadow-2xl shadow-black/40 sm:p-3">
            <div className="overflow-hidden rounded-[20px] border border-white/8 bg-[#0a1322]">
              <div className="flex h-12 items-center gap-2 border-b border-white/8 px-4"><span className="h-2.5 w-2.5 rounded-full bg-rose-400/70"/><span className="h-2.5 w-2.5 rounded-full bg-amber-300/70"/><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70"/><span className="ml-4 text-xs text-slate-500">Fleet OS · Command center</span></div>
              <div className="grid min-h-[390px] grid-cols-[62px_1fr] sm:grid-cols-[185px_1fr]">
                <div className="border-r border-white/8 p-3 sm:p-4"><div className="mb-7 h-8 rounded-lg bg-cyan-400/15" />{['Overview','Dispatch','Vehicles','Maintenance','Invoices'].map((item, index) => <div key={item} className={`mb-2 flex h-9 items-center rounded-lg px-2 text-xs ${index === 0 ? 'bg-white/8 text-white' : 'text-slate-500'}`}><span className="mx-auto sm:mx-0 sm:mr-2 h-2 w-2 rounded-full bg-slate-600"/><span className="hidden sm:inline">{item}</span></div>)}</div>
                <div className="p-4 sm:p-7">
                  <div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">MONDAY · 08:42</p><h3 className="mt-1 text-lg font-semibold">Good morning, Northline</h3></div><span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">All systems live</span></div>
                  <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Active vehicles','42','+3'],['Jobs today','18','76%'],['Service due','5','2 urgent'],['Open invoices','$28.4k','8 total']].map(([label,value,meta]) => <div key={label} className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p><p className="mt-1 text-[10px] text-cyan-300">{meta}</p></div>)}</div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center justify-between"><span className="text-xs font-medium">Today’s dispatch</span><CalendarDays className="h-4 w-4 text-slate-500"/></div><div className="mt-4 space-y-2">{[['07:30','R-1042 · Lakeside Foods','On route','text-cyan-300'],['09:15','R-1048 · Aspen Supply','Loading','text-amber-300'],['11:00','R-1051 · Metro Works','Assigned','text-teal-300']].map(([time,job,status,color]) => <div key={job} className="grid grid-cols-[45px_1fr_auto] items-center gap-2 rounded-lg bg-white/[0.035] px-3 py-2.5 text-[10px]"><span className="text-slate-500">{time}</span><span className="truncate text-slate-300">{job}</span><span className={color}>{status}</span></div>)}</div></div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center justify-between"><span className="text-xs font-medium">Fleet health</span><BarChart3 className="h-4 w-4 text-slate-500"/></div><div className="mt-5 flex items-end gap-2">{[48,68,55,82,72,91,84].map((height,index) => <div key={index} className="flex-1 rounded-sm bg-cyan-400/60" style={{height: `${height}px`, opacity: .45 + index * .07}} />)}</div><p className="mt-3 text-[10px] text-slate-500">91% service compliance this week</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-y border-white/8 bg-white/[0.018] px-5 py-24 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">One connected platform</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Less system hopping. More work moving.</h2><p className="mt-4 leading-7 text-slate-400">Every module shares the same operational context, so handoffs stay visible from first request to final payment.</p></div><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{capabilities.map(({icon:Icon,title,copy,color}) => <article key={title} className="group rounded-2xl border border-white/8 bg-[#0a1424] p-6 transition hover:-translate-y-1 hover:border-white/15"><div className={`grid h-11 w-11 place-items-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p><div className="mt-5 flex items-center text-xs font-medium text-slate-500 transition group-hover:text-cyan-300">Explore capability <ChevronRight className="ml-1 h-3.5 w-3.5" /></div></article>)}</div></div>
      </section>

      <section id="workflow" className="px-5 py-24 sm:px-8 lg:px-10"><div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">From signal to action</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">The workflow stays intact.</h2><p className="mt-4 leading-7 text-slate-400">Fleet OS keeps the operational thread together as work crosses teams. No re-keying. No mystery status. No missing context.</p><button onClick={() => onNavigate('/sign-up')} className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Build your workspace <ArrowRight className="h-4 w-4" /></button></div><div className="grid gap-3">{[['01','Capture','Requests, emails, imported vehicles, and VIN data enter one queue.'],['02','Coordinate','Dispatchers schedule work while teams see the same priorities.'],['03','Complete','Service, delivery, documents, and communications remain attached.'],['04','Close the loop','Completed work becomes an invoice with a clean audit trail.']].map(([number,title,copy],index) => <div key={number} className="grid grid-cols-[48px_1fr] gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-5"><span className={`grid h-10 w-10 place-items-center rounded-xl text-xs font-semibold ${index === 0 ? 'bg-cyan-400 text-slate-950' : 'bg-white/5 text-slate-400'}`}>{number}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p></div></div>)}</div></div></section>

      <section id="security" className="px-5 pb-24 sm:px-8 lg:px-10"><div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.055] px-6 py-12 sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14"><div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl"/><div className="relative max-w-2xl"><ShieldCheck className="h-8 w-8 text-teal-300"/><h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Each customer gets a clean, secure lane.</h2><p className="mt-4 leading-7 text-slate-400">Pod-scoped AgentMail resources and tenant-aware Neon data boundaries keep fleet information isolated while your platform stays simple to operate.</p></div><button onClick={() => onNavigate('/sign-up')} className="relative mt-8 flex h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50 lg:mt-0">Start securely <ArrowRight className="ml-2 h-4 w-4"/></button></div></section>

      <footer className="border-t border-white/8 px-5 py-9 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-cyan-300"/> Fleet OS · Operations, in motion.</div><div className="flex gap-6"><button onClick={() => onNavigate('/sign-in')} className="hover:text-white">Sign in</button><button onClick={() => onNavigate('/sign-up')} className="hover:text-white">Create account</button></div></div></footer>
    </main>
  );
}
