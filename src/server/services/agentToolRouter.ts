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

const has = (text: string, terms: string[]) => terms.some(term => text.includes(term));

export function planAgentTools(userText: string): AgentToolPlan {
  const text = String(userText || '').toLowerCase();
  const tools = new Set<AgentReadTool>();

  const personIntent = has(text, ['who is ', 'contact', 'email address', 'phone number', 'decision maker', 'manager', 'owner', 'zachary']);
  const prospectIntent = has(text, ['prospect', 'lead', 'pipeline', 'opportunity', 'qualified', 'outreach', 'follow up', 'follow-up']);
  const accountIntent = has(text, ['customer', 'client', 'fleet account', 'account', 'company']);
  const vehicleIntent = has(text, ['vehicle', 'unit ', 'vin', 'truck', 'van', 'car', 'oil filter', 'oil type', 'oil capacity', 'mileage', 'engine hours']);
  const workOrderIntent = has(text, ['work order', 'wo-', 'service order', 'repair order', 'scheduled service']);
  const maintenanceIntent = has(text, ['maintenance', 'pm ', 'preventive', 'due', 'overdue', 'service interval', 'next service']);
  const emailIntent = has(text, ['email', 'inbox', 'message', 'thread', 'reply', 'replied', 'conversation', 'sent', 'wrote', 'said']);

  if (personIntent) { tools.add('contacts.search'); tools.add('prospects.search'); tools.add('fleetAccounts.search'); tools.add('email.search'); }
  if (prospectIntent) { tools.add('prospects.search'); tools.add('contacts.search'); tools.add('prospectActivity.search'); tools.add('email.search'); }
  if (accountIntent) { tools.add('fleetAccounts.search'); tools.add('contacts.search'); tools.add('prospects.search'); tools.add('vehicles.search'); tools.add('workOrders.search'); tools.add('email.search'); }
  if (vehicleIntent) { tools.add('vehicles.search'); tools.add('fleetAccounts.search'); tools.add('workOrders.search'); tools.add('maintenance.search'); }
  if (workOrderIntent) { tools.add('workOrders.search'); tools.add('vehicles.search'); tools.add('fleetAccounts.search'); }
  if (maintenanceIntent) { tools.add('maintenance.search'); tools.add('vehicles.search'); tools.add('workOrders.search'); tools.add('fleetAccounts.search'); }
  if (emailIntent) { tools.add('email.search'); tools.add('contacts.search'); tools.add('prospects.search'); tools.add('fleetAccounts.search'); }

  // For a named-entity question with no obvious domain word, search the high-value relationship sources.
  if (!tools.size && /\b[A-Z][a-z]{2,}\b/.test(userText)) {
    tools.add('contacts.search'); tools.add('prospects.search'); tools.add('fleetAccounts.search'); tools.add('email.search');
  }

  const explicitBrowser = has(text, ['browse ', 'browser ', 'open the website', 'go to ', 'click ', 'fill out', 'fill in', 'submit form', 'log in', 'login to', 'reorder', 'place order', 'purchase', 'upload to']);
  const webResearch = /https?:\/\//i.test(userText) || has(text, ['research ', 'look up online', 'search the web', 'website', 'web research']);
  const webMode: AgentWebMode = explicitBrowser ? 'browser' : webResearch ? 'research' : 'none';

  return {
    readTools: [...tools],
    webMode,
    reason: tools.size ? 'Selected from the user request using deterministic Fleet OS intent routing.' : 'No Fleet data lookup was required by the request.',
  };
}
