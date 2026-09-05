import { callAICompletion, type AIMessage, type AIToolCall, type AIToolDefinition } from './ai.js';
import { createAgentActionProposal } from './agentActions.js';
import { searchAgentRuntimeContext } from './agentRuntimeSearch.js';
import { searchAgentOperationalContext } from './agentRuntimeOperations.js';
import { maintenanceIntelligenceService } from './maintenanceIntelligence.js';
import { financialReadModelService } from './financialReadModel.js';
import { executeWebCapability } from './webCapabilityRouter.js';
import { decodeVin, isValidVin, normalizeVin } from './nhtsa.js';
import { getFleetKnowledgeContext } from './fleetKnowledge.js';
import { searchFleetChangeLedger } from './fleetAuditSearch.js';
import type { AgentReadTool, AgentToolPlan, AgentWebCapability } from './agentToolRouter.js';

const MAX_TOOL_ROUNDS = 5;
const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const textProp = (description: string) => ({ type: 'string', description });
const numberProp = (description: string) => ({ type: 'number', minimum: 0, description });

const readToolMap: Record<string, AgentReadTool> = {
  search_prospects: 'prospects.search',
  search_prospect_activity: 'prospectActivity.search',
  search_contacts: 'contacts.search',
  search_locations: 'locations.search',
  search_fleet_accounts: 'fleetAccounts.search',
  search_vehicles: 'vehicles.search',
  search_maintenance: 'maintenance.search',
  search_work_orders: 'workOrders.search',
  search_schedule: 'schedule.search',
  search_dispatch: 'dispatch.search',
  search_inspections: 'inspections.search',
  search_authorizations: 'authorizations.search',
  search_financials: 'financials.search',
  get_financial_summary: 'financials.summary',
  search_invoices: 'invoices.search',
  search_payments: 'payments.search',
  search_email: 'email.search',
  search_documents: 'documents.search',
};

const mutationToolMap: Record<string, string> = {
  send_email: 'email.send',
  create_calendar_event: 'calendar.create',
  create_work_order: 'fleet.work_order.create',
  transition_work_order: 'fleet.work_order.transition',
  decide_authorization: 'fleet.authorization.decision',
  convert_prospect: 'fleet.prospect.convert',
  create_fleet_account: 'fleet.account.create',
  create_fleet_contact: 'fleet.contact.create',
  add_fleet_vehicle: 'fleet.vehicle.create',
  onboard_fleet_customer: 'fleet.customer.onboard',
};

const queryTool = (name: string, description: string): AIToolDefinition => ({
  type: 'function',
  function: { name, description, parameters: objectSchema({ query: textProp('What to search for in this Fleet organization.') }, ['query']) },
});

const contactSchema = objectSchema({
  name: textProp('Contact name'), email: textProp('Optional contact email'), phone: textProp('Optional contact phone'),
  role: textProp('Optional role/title'), notes: textProp('Optional notes'), isPrimary: { type: 'boolean', description: 'Whether this is the primary Fleet contact' },
}, ['name']);
const vehicleSchema = objectSchema({
  unitNumber: textProp('Vehicle unit number'), vin: textProp('Optional 17-character VIN'), year: numberProp('Optional model year'),
  make: textProp('Optional make'), model: textProp('Optional model'), engine: textProp('Optional engine'), mileage: numberProp('Optional mileage'),
  engineHours: numberProp('Optional engine hours'), licensePlate: textProp('Optional license plate'), registrationState: textProp('Optional registration state'),
  assignedDriver: textProp('Optional assigned driver'), department: textProp('Optional department'), notes: textProp('Optional notes'),
}, ['unitNumber']);
const accountSchema = objectSchema({
  name: textProp('Fleet account/company name'), accountNumber: textProp('Optional account number'), primaryContactName: textProp('Optional primary contact name'),
  primaryContactEmail: textProp('Optional primary contact email'), phone: textProp('Optional phone'), notes: textProp('Optional notes'),
}, ['name']);

export const FLEET_AGENT_TOOLS: AIToolDefinition[] = [
  queryTool('search_fleet_knowledge', 'Fuzzy-search the tenant Fleet knowledge directory across accounts, contacts, prospects, team, technicians, vehicles, and work orders. Use this first when a name or identifier may be misspelled or ambiguous.'),
  queryTool('search_change_ledger', 'Search the tenant audit/change ledger to determine what changed, who or what changed it, and when.'),
  queryTool('search_prospects', 'Search tenant prospects and lead/company records.'),
  queryTool('search_prospect_activity', 'Search tenant prospect activity and outreach history.'),
  queryTool('search_contacts', 'Search tenant customer contacts, prospect contacts, members, and technicians.'),
  queryTool('search_locations', 'Search tenant service and customer locations.'),
  queryTool('search_fleet_accounts', 'Search tenant fleet/customer accounts.'),
  queryTool('search_vehicles', 'Search tenant vehicles by unit, VIN, make, model, driver, or account.'),
  queryTool('search_maintenance', 'Search tenant maintenance schedules and current maintenance attention data.'),
  queryTool('search_work_orders', 'Search tenant work orders.'),
  queryTool('search_schedule', 'Search tenant appointments and schedule.'),
  queryTool('search_dispatch', 'Search tenant dispatch assignments and technician status.'),
  queryTool('search_inspections', 'Search tenant inspections.'),
  queryTool('search_authorizations', 'Search tenant authorizations.'),
  queryTool('search_financials', 'Search tenant service-line financial data.'),
  { type: 'function', function: { name: 'get_financial_summary', description: 'Get the current organization-scoped financial dashboard/summary.', parameters: objectSchema({}) } },
  queryTool('search_invoices', 'Search tenant invoices.'),
  queryTool('search_payments', 'Search tenant payments.'),
  queryTool('search_email', 'Search organization-scoped AgentMail messages.'),
  queryTool('search_documents', 'Search tenant documents and attachments.'),
  { type: 'function', function: { name: 'decode_vin', description: 'Decode a 17-character VIN using NHTSA vPIC.', parameters: objectSchema({ vin: textProp('17-character VIN') }, ['vin']) } },
  { type: 'function', function: { name: 'research_web', description: 'Research public web information or discover companies using the approved Browserbase research path.', parameters: objectSchema({ query: textProp('Research question, company, person, or discovery request; may include a URL.') }, ['query']) } },
  { type: 'function', function: { name: 'browse_web', description: 'Open and interact with a specific public HTTPS page using the approved browser session path. This does not authorize consequential submission.', parameters: objectSchema({ url: textProp('Direct HTTPS URL'), instruction: textProp('What to inspect or do on the page') }, ['url','instruction']) } },
  { type: 'function', function: { name: 'read_web_document', description: 'Fetch/read a public document or PDF from a direct HTTPS URL.', parameters: objectSchema({ url: textProp('Direct HTTPS document URL'), instruction: textProp('What information to extract') }, ['url']) } },
  { type: 'function', function: { name: 'prepare_web_form', description: 'Inspect and prepare fields for a public web form. Never submit consequential forms automatically.', parameters: objectSchema({ url: textProp('Direct HTTPS form URL'), instruction: textProp('What fields should be prepared') }, ['url','instruction']) } },
  { type: 'function', function: { name: 'send_email', description: 'Prepare a tenant-scoped outbound email for explicit confirmation. This tool never sends automatically.', parameters: objectSchema({ to: textProp('Recipient email'), subject: textProp('Subject'), text: textProp('Plain-text body'), prospectId: textProp('Optional canonical prospect ID'), contactId: textProp('Optional canonical contact ID') }, ['to','subject','text']) } },
  { type: 'function', function: { name: 'create_calendar_event', description: 'Prepare a calendar event for explicit confirmation.', parameters: objectSchema({ summary: textProp('Event title'), start: textProp('ISO date-time start'), end: textProp('ISO date-time end'), description: textProp('Optional description'), location: textProp('Optional location'), attendees: { type: 'array', items: { type: 'string' }, description: 'Optional attendee email addresses' } }, ['summary','start','end']) } },
  { type: 'function', function: { name: 'create_work_order', description: 'Prepare a Fleet work order for explicit confirmation.', parameters: objectSchema({ vehicleId: textProp('Canonical tenant vehicle ID'), complaint: textProp('Complaint/requested service'), requestedServices: { type: 'array', items: { type: 'string' } }, purchaseOrderNumber: textProp('Optional PO number'), odometer: numberProp('Optional odometer'), engineHours: numberProp('Optional engine hours'), scheduledAt: textProp('Optional ISO scheduled time'), priority: textProp('Optional priority'), customerNotes: textProp('Optional customer notes'), technicianNotes: textProp('Optional technician notes') }, ['vehicleId','complaint']) } },
  { type: 'function', function: { name: 'transition_work_order', description: 'Prepare a work-order status transition for explicit confirmation.', parameters: objectSchema({ workOrderId: textProp('Canonical tenant work-order ID'), status: textProp('Target status') }, ['workOrderId','status']) } },
  { type: 'function', function: { name: 'decide_authorization', description: 'Prepare an authorization decision for explicit confirmation.', parameters: objectSchema({ authorizationId: textProp('Canonical tenant authorization ID'), decision: { type: 'string', enum: ['authorized','rejected'] }, authorizedBy: textProp('Optional authorizer'), authorizationMethod: textProp('Optional authorization method'), purchaseOrderNumber: textProp('Optional PO number'), notes: textProp('Optional decision notes') }, ['authorizationId','decision']) } },
  { type: 'function', function: { name: 'convert_prospect', description: 'Prepare conversion of a tenant prospect to a fleet account for explicit confirmation.', parameters: objectSchema({ prospectId: textProp('Canonical tenant prospect ID') }, ['prospectId']) } },
  { type: 'function', function: { name: 'create_fleet_account', description: 'Prepare creation of a Fleet Account for explicit confirmation. Search first to avoid duplicates.', parameters: accountSchema } },
  { type: 'function', function: { name: 'create_fleet_contact', description: 'Prepare a contact linked to an existing Fleet Account for explicit confirmation. Use the canonical customer ID from search.', parameters: objectSchema({ customerId: textProp('Canonical Fleet Account/customer ID'), ...contactSchema.properties }, ['customerId','name']) } },
  { type: 'function', function: { name: 'add_fleet_vehicle', description: 'Prepare a vehicle linked to an existing Fleet Account for explicit confirmation. Use the canonical customer ID from search.', parameters: objectSchema({ customerId: textProp('Canonical Fleet Account/customer ID'), ...vehicleSchema.properties }, ['customerId','unitNumber']) } },
  { type: 'function', function: { name: 'onboard_fleet_customer', description: 'Prepare one reviewed onboarding transaction that creates or reuses a Fleet Account, links a contact, and adds or links vehicles. Use this when the user approves account/contact/vehicle changes together.', parameters: objectSchema({ customerId: textProp('Optional canonical existing Fleet Account/customer ID'), account: accountSchema, contact: contactSchema, vehicles: { type: 'array', maxItems: 50, items: vehicleSchema } }, ['account']) } },
];

function parseArguments(call: AIToolCall) {
  try {
    const parsed = JSON.parse(call.function.arguments || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function planForWeb(capability: AgentWebCapability): AgentToolPlan {
  return { readTools: [], webCapability: capability, webMode: capability === 'research' ? 'research' : capability === 'none' ? 'none' : 'browser', reason: 'Selected by the bounded server-owned Fleet Agent tool loop.' };
}

type ReadExecution = { success: boolean; data?: unknown; error?: string; webExecution?: any };

async function executeReadTool(organizationId: string, name: string, args: Record<string, unknown>, fallbackQuery: string): Promise<ReadExecution> {
  const query = String(args.query || fallbackQuery || '').trim();

  if (name === 'search_fleet_knowledge') return { success: true, data: await getFleetKnowledgeContext(organizationId, query) };
  if (name === 'search_change_ledger') return { success: true, data: await searchFleetChangeLedger(organizationId, query) };
  if (name === 'decode_vin') {
    const vin = normalizeVin(String(args.vin || ''));
    if (!isValidVin(vin)) return { success: false, error: 'A valid 17-character VIN is required.' };
    return { success: true, data: await decodeVin({ vin }) };
  }

  if (['research_web','browse_web','read_web_document','prepare_web_form'].includes(name)) {
    const capability: AgentWebCapability = name === 'research_web' ? 'research' : name === 'browse_web' ? 'browse' : name === 'read_web_document' ? 'document' : 'form';
    const source = name === 'research_web' ? String(args.query || fallbackQuery) : `${String(args.url || '')}\n${String(args.instruction || '')}`.trim();
    const result = await executeWebCapability(source, planForWeb(capability));
    return { success: result.status === 'success', data: result, error: result.status === 'success' ? undefined : result.error || `Web ${result.status}`, webExecution: result };
  }

  const selected = readToolMap[name];
  if (!selected) return { success: false, error: `Unsupported read tool: ${name}` };
  if (selected === 'financials.summary') return { success: true, data: await financialReadModelService.dashboard(organizationId) };
  if (['locations.search','schedule.search','dispatch.search','inspections.search','authorizations.search','financials.search','invoices.search','payments.search','documents.search'].includes(selected)) {
    return { success: true, data: await searchAgentOperationalContext(organizationId, query, [selected]) };
  }

  const core = await searchAgentRuntimeContext(organizationId, query);
  if (selected === 'maintenance.search') return { success: true, data: { matches: core.fleet?.maintenance || [], attention: await maintenanceIntelligenceService.attention(organizationId) } };
  const pick: Partial<Record<AgentReadTool, unknown>> = {
    'prospects.search': core.fleet?.prospects || [],
    'prospectActivity.search': core.fleet?.prospectActivity || [],
    'contacts.search': { contacts: core.fleet?.contacts || [], prospectContacts: core.fleet?.prospectContacts || [], organizationMembers: core.fleet?.organizationMembers || [], technicians: core.fleet?.technicians || [] },
    'fleetAccounts.search': core.fleet?.fleetAccounts || [],
    'vehicles.search': core.fleet?.vehicles || [],
    'workOrders.search': core.fleet?.workOrders || [],
    'email.search': core.emails || [],
  };
  return { success: true, data: pick[selected] ?? [] };
}

export interface FleetAgentLoopResult {
  content: string;
  model: string;
  provider: string;
  actionProposal: ReturnType<typeof createAgentActionProposal> | null;
  toolTrace: Array<{ name: string; success: boolean; confirmationRequired?: boolean }>;
  webExecution: any | null;
  rounds: number;
}

function visibleContent(content: string, actionProposal: FleetAgentLoopResult['actionProposal']) {
  const trimmed = String(content || '').trim();
  if (trimmed) return trimmed;
  if (actionProposal) return `${actionProposal.proposal.summary} is ready for your confirmation.`;
  return 'I completed the lookup but did not receive a usable display response. Nothing was changed.';
}

export async function runFleetAgentToolLoop(input: { organizationId: string; messages: AIMessage[]; systemPrompt: string; latestUserText: string }): Promise<FleetAgentLoopResult> {
  const history: AIMessage[] = [...input.messages];
  const toolTrace: FleetAgentLoopResult['toolTrace'] = [];
  let actionProposal: FleetAgentLoopResult['actionProposal'] = null;
  let webExecution: any | null = null;
  let lastModel = '';
  let lastProvider = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await callAICompletion(history, input.systemPrompt, { tools: FLEET_AGENT_TOOLS, toolChoice: 'auto', temperature: 0.2 });
    lastModel = completion.model;
    lastProvider = completion.provider;
    if (!completion.toolCalls.length) return { content: visibleContent(completion.content, actionProposal), model: lastModel, provider: lastProvider, actionProposal, toolTrace, webExecution, rounds: round + 1 };

    history.push({ role: 'assistant', content: completion.content || '', tool_calls: completion.toolCalls });
    let mutationRequested = false;
    for (const call of completion.toolCalls) {
      const args = parseArguments(call);
      const mutationKind = mutationToolMap[call.function.name];
      if (mutationKind) {
        mutationRequested = true;
        if (!actionProposal) {
          try {
            actionProposal = createAgentActionProposal(mutationKind, args, input.organizationId);
            toolTrace.push({ name: call.function.name, success: true, confirmationRequired: true });
            history.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ success: true, status: 'confirmation_required', proposalId: actionProposal.proposal.id, summary: actionProposal.proposal.summary, message: 'The action is prepared and must be explicitly confirmed before execution.' }) });
          } catch (error) {
            toolTrace.push({ name: call.function.name, success: false, confirmationRequired: true });
            history.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Invalid action proposal' }) });
          }
        } else {
          toolTrace.push({ name: call.function.name, success: false, confirmationRequired: true });
          history.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ success: false, error: 'Only one consequential action may be prepared per assistant turn. Use onboard_fleet_customer when account, contact, and vehicle changes belong in one reviewed transaction.' }) });
        }
        continue;
      }
      try {
        const result = await executeReadTool(input.organizationId, call.function.name, args, input.latestUserText);
        if (result.webExecution) webExecution = result.webExecution;
        toolTrace.push({ name: call.function.name, success: result.success });
        history.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result.success ? { success: true, data: result.data } : { success: false, error: result.error }) });
      } catch (error) {
        toolTrace.push({ name: call.function.name, success: false });
        history.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Tool execution failed' }) });
      }
    }

    if (mutationRequested) {
      const final = await callAICompletion(history, `${input.systemPrompt}\n\nA consequential action has been prepared but NOT executed. Tell the user what is ready for confirmation. Do not claim it happened.`, { toolChoice: 'none', temperature: 0.2 });
      return { content: visibleContent(final.content, actionProposal), model: final.model, provider: final.provider, actionProposal, toolTrace, webExecution, rounds: round + 1 };
    }
  }

  const final = await callAICompletion(history, `${input.systemPrompt}\n\nThe bounded five-round tool limit has been reached. Answer using only the verified tool results already present. Do not request another tool.`, { toolChoice: 'none', temperature: 0.2 });
  return { content: visibleContent(final.content, actionProposal), model: final.model, provider: final.provider, actionProposal, toolTrace, webExecution, rounds: MAX_TOOL_ROUNDS };
}
