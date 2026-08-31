import React from 'react';
import {
  Car,
  ClipboardList,
  Wrench,
  CalendarClock,
  PackageSearch,
  Building2,
  BadgeDollarSign,
  Files,
  ArrowRight,
  Inbox
} from 'lucide-react';

export type FleetModuleId =
  | 'vehicles'
  | 'work-orders'
  | 'maintenance'
  | 'schedule'
  | 'dispatch'
  | 'parts'
  | 'customers'
  | 'financials'
  | 'documents';

const moduleContent: Record<FleetModuleId, {
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  vehicles: {
    title: 'Vehicles',
    eyebrow: 'Fleet registry',
    description: 'Track unit numbers, VINs, mileage, assignments, specifications, and service history.',
    emptyTitle: 'Build your fleet registry',
    emptyDescription: 'Vehicles matched from incoming fleet requests will appear here.',
    icon: Car
  },
  'work-orders': {
    title: 'Work Orders',
    eyebrow: 'Service operations',
    description: 'Manage every job from request and inspection through authorization and completion.',
    emptyTitle: 'Turn requests into work orders',
    emptyDescription: 'Use Fleet Inbox to review a request, identify its vehicle, and start a work order.',
    icon: ClipboardList
  },
  maintenance: {
    title: 'Maintenance',
    eyebrow: 'Preventive maintenance',
    description: 'Plan recurring service intervals and see what is due, upcoming, or overdue.',
    emptyTitle: 'Set maintenance schedules',
    emptyDescription: 'Service intervals will become available after vehicles are added.',
    icon: Wrench
  },
  schedule: {
    title: 'Schedule',
    eyebrow: 'Service calendar',
    description: 'Turn approved fleet requests into appointments with dates, service windows, and locations.',
    emptyTitle: 'Schedule approved requests',
    emptyDescription: 'Ready-to-book requests and work orders will appear here.',
    icon: CalendarClock
  },
  dispatch: {
    title: 'Dispatch',
    eyebrow: 'Field operations',
    description: 'Coordinate appointments, technicians, service locations, and live job status.',
    emptyTitle: 'Prepare the dispatch board',
    emptyDescription: 'Scheduled work orders will appear here for assignment.',
    icon: CalendarClock
  },
  parts: {
    title: 'Parts',
    eyebrow: 'Parts and inventory',
    description: 'Manage fitment, required parts, stock, purchase requests, and job allocation.',
    emptyTitle: 'Connect parts to service',
    emptyDescription: 'Required parts will appear as inspections and work orders are created.',
    icon: PackageSearch
  },
  customers: {
    title: 'Customers',
    eyebrow: 'Fleet accounts',
    description: 'Organize fleet companies, locations, contacts, billing rules, and communication history.',
    emptyTitle: 'Create your first fleet account',
    emptyDescription: 'Contacts identified in Fleet Inbox can be connected to customer accounts.',
    icon: Building2
  },
  financials: {
    title: 'Invoices & Financials',
    eyebrow: 'Billing and revenue',
    description: 'Track estimates, purchase orders, invoices, payments, and account balances.',
    emptyTitle: 'Follow the job to payment',
    emptyDescription: 'Financial activity will appear after work orders are authorized and invoiced.',
    icon: BadgeDollarSign
  },
  documents: {
    title: 'Documents',
    eyebrow: 'Fleet records',
    description: 'Keep inspections, photos, receipts, authorizations, and service records together.',
    emptyTitle: 'Centralize fleet documents',
    emptyDescription: 'Files attached to messages and work orders will be organized here.',
    icon: Files
  }
};

interface FleetModuleViewProps {
  module: FleetModuleId;
  onOpenInbox: () => void;
}

export const FleetModuleView: React.FC<FleetModuleViewProps> = ({ module, onOpenInbox }) => {
  const content = moduleContent[module];
  const Icon = content.icon;

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">{content.eyebrow}</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{content.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{content.description}</p>
          </div>
        </div>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <Icon className="h-7 w-7" />
          </div>
          <h3 className="mt-5 text-lg font-bold text-slate-900">{content.emptyTitle}</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{content.emptyDescription}</p>
          <button
            type="button"
            onClick={onOpenInbox}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Inbox className="h-4 w-4" />
            Open Fleet Inbox
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Fleet service lifecycle</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">Request → Schedule → Dispatch → Inspection → Authorization → Service → Invoice</p>
        </div>
      </div>
    </main>
  );
};
