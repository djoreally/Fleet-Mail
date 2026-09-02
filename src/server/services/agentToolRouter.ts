export type AgentReadTool =
  | 'prospects.search'
  | 'contacts.search'
  | 'fleetAccounts.search'
  | 'vehicles.search'
  | 'workOrders.search'
  | 'maintenance.search'
  | 'prospectActivity.search'
  | 'email.search';

export type AgentWebMode = 'none' | 'research' | 'browser';

export interface AgentToolPlan {
  readTools: AgentReadTool[];
  webMode: AgentWebMode;
  reason: string;
}

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

export function planAgentTools(userText: string): AgentToolPlan {
  const source = String(userText || '');
  const text = source.toLowerCase();
  const tools = new Set<AgentReadTool>();

  const personIntent = includesAny(text, ['who is ', 'contact', 'email address', 'phone number', 'decision maker', 'manager', 'owner']);
  const prospectIntent = includesAny(text, ['prospect', 'lead', 'pipeline', 'opportunity', 'qualified', 'outreach', 'follow up', 'follow-up']);
  const accountIntent = includesAny(text, ['customer', 'client', 'fleet account', 'company']);
  const vehicleIntent = includesAny(text, ['vehicle', 'unit ', 'vin', 'truck', 'van', 'oil filter', 'oil type', 'oil capacity', 'mileage', 'engine hours']);
  const workOrderIntent = includesAny(text, ['work order', 'wo-', 'service order', 'repair order', 'scheduled service']);
  const maintenanceIntent = includesAny(text, ['maintenance', 'pm ', 'preventive', 'due', 'overdue', 'service interval', 'next service']);
  const emailIntent = includesAny(text, ['email', 'inbox', 'message', 'thread', 'reply', 'replied', 'conversation', 'sent', 'wrote', 'said']);

  if (personIntent) {
    tools.add('contacts.search');
    tools.add('prospects.search');
    tools.add('fleetAccounts.search');
    tools.add('email.search');
  }
  if (prospectIntent) {
    tools.add('prospects.search');
    tools.add('contacts.search');
    tools.add('prospectActivity.search');
    tools.add('email.search');
  }
  if (accountIntent) {
    tools.add('fleetAccounts.search');
    tools.add('contacts.search');
    tools.add('prospects.search');
    tools.add('vehicles.search');
    tools.add('workOrders.search');
    tools.add('email.search');
  }
  if (vehicleIntent) {
    tools.add('vehicles.search');
    tools.add('fleetAccounts.search');
    tools.add('workOrders.search');
    tools.add('maintenance.search');
  }
  if (workOrderIntent) {
    tools.add('workOrders.search');
    tools.add('vehicles.search');
    tools.add('fleetAccounts.search');
  }
  if (maintenanceIntent) {
    tools.add('maintenance.search');
    tools.add('vehicles.search');
    tools.add('workOrders.search');
    tools.add('fleetAccounts.search');
  }
  if (emailIntent) {
    tools.add('email.search');
    tools.add('contacts.search');
    tools.add('prospects.search');
    tools.add('fleetAccounts.search');
  }

  if (!tools.size && /\b[A-Z][a-z]{2,}\b/.test(source)) {
    tools.add('contacts.search');
    tools.add('prospects.search');
    tools.add('fleetAccounts.search');
    tools.add('email.search');
  }

  const explicitBrowser = includesAny(text, ['browse ', 'browser ', 'open the website', 'go to ', 'click ', 'fill out', 'fill in', 'submit form', 'log in', 'login to', 'reorder', 'place order', 'purchase', 'upload to']);
  const webResearch = /https?:\/\//i.test(source) || includesAny(text, ['research ', 'look up online', 'search the web', 'website', 'web research']);

  return {
    readTools: [...tools],
    webMode: explicitBrowser ? 'browser' : webResearch ? 'research' : 'none',
    reason: tools.size
      ? 'Selected from the user request using deterministic Fleet OS intent routing.'
      : 'No Fleet data lookup was required by the request.',
  };
}
