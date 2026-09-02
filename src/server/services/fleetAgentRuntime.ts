import type { NextFunction, Request, Response } from 'express';
import { requireFleetOrganization } from './fleetAuth.js';
import { resolveAgentRuntimeOrganization, searchAgentRuntimeContext } from './agentRuntimeSearch.js';
import { searchAgentOperationalContext } from './agentRuntimeOperations.js';
import { planAgentTools } from './agentToolRouter.js';
import { maintenanceIntelligenceService } from './maintenanceIntelligence.js';
import { financialReadModelService } from './financialReadModel.js';

const FLEET_ACTION_POLICY = `Fleet OS agent tool policy.

Live reads are organization-scoped and may be used directly when present in the trusted runtime results below.
All writes are proposals only. Never claim a record, email, calendar event, browser interaction, payment, invoice, schedule, dispatch, inspection, authorization, prospect conversion, or work order was created or changed until the confirmation-gated executor returns success.
Browserbase is explicit-action-only. Never use Browserbase as a research fallback. Firecrawl is the research tool. A browser-mode plan describes intent only and does not authorize execution.

Supported confirmation-gated actions:
- email.send
- calendar.create
- fleet.work_order.create
- fleet.work_order.transition
- fleet.authorization.decision
- fleet.prospect.convert

For one of those requests, prepare exactly one reviewable block:
\`\`\`json:agent_action
{"kind":"supported.action.kind","payload":{}}
\`\`\`
Use the exact action payload contract. Work-order creation requires vehicleId and complaint. Work-order transition requires workOrderId and status. Authorization decision requires authorizationId and decision of authorized or rejected. Prospect conversion requires prospectId. Email requires to, subject, and text. Calendar requires summary, start, and end.

Any other mutation is not executable yet: explain that it requires a controlled action implementation. Never translate an unsupported mutation into a nearby supported action.
Use canonical IDs from trusted runtime data. If a requested record is ambiguous or no canonical ID is available, ask for the minimum clarification instead of guessing. Never construct organization IDs or entity IDs.`;

function latestUserMessageIndex(messages: unknown[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { role?: unknown } | null;
    if (message?.role === 'user') return index;
  }
  return -1;
}

async function resolveOrganization(req: Request) {
  if (req.header('authorization')?.startsWith('Bearer ')) {
    return requireFleetOrganization(req);
  }
  return resolveAgentRuntimeOrganization(String(req.body?.contextInbox || ''));
}

export async function fleetAgentRuntimeMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'POST') return next();

  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const latestUserIndex = latestUserMessageIndex(messages);
    if (latestUserIndex < 0) return next();

    const latestUserText = String(messages[latestUserIndex]?.content || '');
    const toolPlan = planAgentTools(latestUserText);
    req.body.agentToolPlan = toolPlan;

    if (!toolPlan.readTools.length) return next();

    const organizationId = await resolveOrganization(req);
    if (!organizationId) return next();

    const wantsFinancialDashboard = toolPlan.readTools.some((tool) => ['financials.search', 'financials.summary', 'invoices.search', 'payments.search'].includes(tool));
    const [coreRuntime, operations, maintenance, financials] = await Promise.all([
      searchAgentRuntimeContext(organizationId, latestUserText),
      searchAgentOperationalContext(organizationId, latestUserText, toolPlan.readTools),
      toolPlan.readTools.includes('maintenance.search') ? maintenanceIntelligenceService.attention(organizationId) : Promise.resolve(null),
      wantsFinancialDashboard ? financialReadModelService.dashboard(organizationId) : Promise.resolve(null),
    ]);
    const runtime = { ...coreRuntime, operations, maintenanceIntelligence: maintenance, financials };
    const hasCoreMatches = Object.values(coreRuntime.fleet || {}).some((value) => Array.isArray(value) && value.length > 0);
    const hasOperationalMatches = Object.values(operations).some((value) => Array.isArray(value) && value.length > 0);
    const hasRuntimeMatches = hasCoreMatches || hasOperationalMatches || coreRuntime.emails.length > 0 || Boolean(maintenance) || Boolean(financials);
    const selectedTools = toolPlan.readTools.join(', ');

    const runtimeContext = hasRuntimeMatches
      ? `\n\nTrusted Fleet OS tool results for the latest request. The deterministic router selected: ${selectedTools}. These results are live and organization-scoped. Use matching records before saying data is unavailable. If multiple records match, explain the ambiguity.\n${JSON.stringify(runtime)}`
      : `\n\nThe deterministic Fleet tool router selected: ${selectedTools}. No matching live Fleet or AgentMail records were found for the latest request. Do not invent a record or identifier.`;

    req.body.messages = [
      ...messages.slice(0, latestUserIndex),
      { role: 'system', content: `${FLEET_ACTION_POLICY}${runtimeContext}` },
      ...messages.slice(latestUserIndex),
    ];
  } catch (error) {
    console.warn('Fleet agent runtime unavailable:', error instanceof Error ? error.message : error);
    if (req.header('authorization')?.startsWith('Bearer ')) return res.status(401).json({ error: 'Valid Fleet organization access is required' });
  }

  return next();
}