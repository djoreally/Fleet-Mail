export type AgentReadTool =
  | 'prospects.search'
  | 'prospectActivity.search'
  | 'contacts.search'
  | 'locations.search'
  | 'fleetAccounts.search'
  | 'vehicles.search'
  | 'maintenance.search'
  | 'workOrders.search'
  | 'schedule.search'
  | 'dispatch.search'
  | 'inspections.search'
  | 'authorizations.search'
  | 'financials.search'
  | 'financials.summary'
  | 'invoices.search'
  | 'payments.search'
  | 'email.search'
  | 'documents.search';

export type AgentWebMode = 'none' | 'research' | 'browser';
export type AgentWebCapability = 'none' | 'research' | 'browse' | 'document' | 'form';

export interface AgentToolPlan {
  readTools: AgentReadTool[];
  webMode: AgentWebMode;
  webCapability: AgentWebCapability;
  reason: string;
}

export const AGENT_READ_TOOL_CATALOG: readonly AgentReadTool[] = [
  'prospects.search', 'prospectActivity.search', 'contacts.search', 'locations.search',
  'fleetAccounts.search', 'vehicles.search', 'maintenance.search', 'workOrders.search',
  'schedule.search', 'dispatch.search', 'inspections.search', 'authorizations.search',
  'financials.search', 'financials.summary', 'invoices.search', 'payments.search', 'email.search', 'documents.search',
] as const;

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

function webCapabilityFor(source: string, text: string): AgentWebCapability {
  const hasUrl = /https?:\/\//i.test(source);
  const formIntent = includesAny(text, ['fill out', 'fill in', 'complete the form', 'vendor registration', 'registration form', 'application form', 'submit form']);
  const documentIntent = includesAny(text, ['download ', 'download the', 'receipt', 'pdf', 'document from', 'parse the document', 'extract the pdf']);
  const browseIntent = includesAny(text, ['browse ', 'browser ', 'open the website', 'go to ', 'click ', 'log in', 'login to', 'navigate to', 'open this page']);
  const researchIntent = hasUrl || includesAny(text, ['research ', 'look up online', 'search the web', 'website', 'web research', 'find companies', 'find prospects', 'search online']);

  if (formIntent) return 'form';
  if (documentIntent && hasUrl) return 'document';
  if (browseIntent) return 'browse';
  if (researchIntent) return 'research';
  return 'none';
}

export function planAgentTools(userText: string): AgentToolPlan {
  const source = String(userText || '');
  const text = source.toLowerCase();
  const tools = new Set<AgentReadTool>();
  const add = (...selected: AgentReadTool[]) => selected.forEach((tool) => tools.add(tool));

  const personIntent = includesAny(text, ['who is ', 'contact', 'email address', 'phone number', 'decision maker', 'manager', 'owner']);
  const prospectIntent = includesAny(text, ['prospect', 'lead', 'pipeline', 'opportunity', 'qualified', 'outreach', 'follow up', 'follow-up']);
  const accountIntent = includesAny(text, ['customer', 'client', 'fleet account', 'company']);
  const locationIntent = includesAny(text, ['location', 'service address', 'billing address', 'where is', 'site ']);
  const vehicleIntent = includesAny(text, ['vehicle', 'unit ', 'vin', 'truck', 'van', 'oil filter', 'oil type', 'oil capacity', 'mileage', 'engine hours']);
  const workOrderIntent = includesAny(text, ['work order', 'wo-', 'service order', 'repair order', 'scheduled service']);
  const maintenanceIntent = includesAny(text, ['maintenance', 'pm ', 'preventive', 'due', 'overdue', 'service interval', 'next service']);
  const scheduleIntent = includesAny(text, ['schedule', 'appointment', 'calendar', 'availability', 'when is', 'reschedule']);
  const dispatchIntent = includesAny(text, ['dispatch', 'technician', 'assigned', 'en route', 'arrived', 'resource']);
  const inspectionIntent = includesAny(text, ['inspection', 'inspect', 'condition', 'measurement', 'tread', 'brake pad', 'recommendation']);
  const authorizationIntent = includesAny(text, ['authorization', 'authorize', 'approval', 'approve', 'reject', 'decline', 'po required']);
  const financialIntent = includesAny(text, ['financial', 'revenue', 'profit', 'margin', 'cost', 'labor', 'parts', 'fluid', 'estimate', 'aging']);
  const invoiceIntent = includesAny(text, ['invoice', 'balance', 'balance due', 'receivable', 'billing', 'due date', 'past due']);
  const paymentIntent = includesAny(text, ['payment', 'paid', 'unpaid', 'refund', 'stripe', 'transaction']);
  const emailIntent = includesAny(text, ['email', 'inbox', 'message', 'thread', 'reply', 'replied', 'conversation', 'sent', 'wrote', 'said']);
  const documentIntent = includesAny(text, ['document', 'attachment', 'pdf', 'docx', 'file ', 'photo', 'image']);

  if (personIntent) add('contacts.search', 'prospects.search', 'fleetAccounts.search', 'email.search');
  if (prospectIntent) add('prospects.search', 'contacts.search', 'prospectActivity.search', 'email.search');
  if (accountIntent) add('fleetAccounts.search', 'contacts.search', 'locations.search', 'prospects.search', 'vehicles.search', 'workOrders.search', 'email.search');
  if (locationIntent) add('locations.search', 'fleetAccounts.search', 'vehicles.search', 'schedule.search');
  if (vehicleIntent) add('vehicles.search', 'fleetAccounts.search', 'workOrders.search', 'maintenance.search', 'documents.search');
  if (workOrderIntent) add('workOrders.search', 'vehicles.search', 'fleetAccounts.search', 'schedule.search', 'dispatch.search', 'inspections.search', 'authorizations.search', 'financials.search');
  if (maintenanceIntent) add('maintenance.search', 'vehicles.search', 'workOrders.search', 'fleetAccounts.search');
  if (scheduleIntent) add('schedule.search', 'dispatch.search', 'workOrders.search', 'vehicles.search', 'locations.search');
  if (dispatchIntent) add('dispatch.search', 'schedule.search', 'workOrders.search');
  if (inspectionIntent) add('inspections.search', 'authorizations.search', 'workOrders.search', 'vehicles.search', 'documents.search');
  if (authorizationIntent) add('authorizations.search', 'inspections.search', 'workOrders.search', 'financials.search');
  if (financialIntent) add('financials.search', 'financials.summary', 'invoices.search', 'payments.search', 'workOrders.search', 'fleetAccounts.search');
  if (invoiceIntent) add('invoices.search', 'payments.search', 'financials.search', 'financials.summary', 'fleetAccounts.search', 'workOrders.search');
  if (paymentIntent) add('payments.search', 'invoices.search', 'financials.search', 'financials.summary', 'fleetAccounts.search');
  if (emailIntent) add('email.search', 'contacts.search', 'prospects.search', 'fleetAccounts.search');
  if (documentIntent) add('documents.search', 'fleetAccounts.search', 'vehicles.search', 'workOrders.search');

  if (!tools.size && /\b[A-Z][a-z]{2,}\b/.test(source)) add('contacts.search', 'prospects.search', 'fleetAccounts.search', 'email.search');

  const webCapability = webCapabilityFor(source, text);
  return {
    readTools: [...tools],
    webCapability,
    webMode: webCapability === 'research' ? 'research' : webCapability === 'none' ? 'none' : 'browser',
    reason: tools.size
      ? 'Selected from the user request using deterministic Fleet OS intent routing.'
      : 'No Fleet data lookup was required by the request.',
  };
}
