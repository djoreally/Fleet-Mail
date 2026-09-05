import type { NextFunction, Request, Response } from 'express';
import { requireFleetOrganization } from './fleetAuth.js';
import { searchAgentRuntimeContext } from './agentRuntimeSearch.js';
import { searchAgentOperationalContext } from './agentRuntimeOperations.js';
import { planAgentTools } from './agentToolRouter.js';
import { maintenanceIntelligenceService } from './maintenanceIntelligence.js';
import { financialReadModelService } from './financialReadModel.js';
import { getFleetKnowledgeContext } from './fleetKnowledge.js';

const FLEET_ACTION_POLICY = `Fleet OS agent data and action policy.

You DO have controlled access to this organization's Fleet data through the Fleet Knowledge Layer and deterministic server-owned read tools. Never say you lack a search function, database access, or access to contacts/prospects/fleet accounts when Fleet Knowledge context is present. If nothing matches, say that no matching organization-scoped record was found and ask only for the minimum clarification needed.
The model never receives raw SQL, database credentials, or unrestricted table access. Use canonical records and IDs supplied by trusted middleware.
Fleet Knowledge is a cached organization-scoped directory and recent-change ledger. Matching can be fuzzy, so treat high-scoring name matches as candidates and state ambiguity when more than one plausible record exists. Deterministic live tools provide deeper task-specific detail when selected.

Live reads are organization-scoped and may be used directly when present in the trusted runtime results below.
All writes are proposals only. Never claim a record, email, calendar event, browser interaction, payment, invoice, schedule, dispatch, inspection, authorization, prospect conversion, or work order was created or changed until the confirmation-gated executor returns success.
Browserbase Search is the primary discovery path for public-web research. Browserbase Fetch is the lightweight page-retrieval path. Stagehand/Browserbase browser sessions are used for interactive or JavaScript-heavy browser work. Browserbase Functions may back reusable browser automations. Firecrawl is compatibility fallback only when Browserbase research is unavailable. A browser-mode plan describes intent only and does not authorize execution.

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

export async function fleetAgentRuntimeMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'POST') return next();

  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const latestUserIndex = latestUserMessageIndex(messages);
    if (latestUserIndex < 0) return next();

    const latestUserText = String(messages[latestUserIndex]?.content || '');
    const toolPlan = planAgentTools(latestUserText);
    req.body.agentToolPlan = toolPlan;
    const organizationId = await requireFleetOrganization(req);

    const knowledgePromise = getFleetKnowledgeContext(organizationId, latestUserText);
    const wantsFinancialDashboard = toolPlan.readTools.some((tool) => ['financials.search', 'financials.summary', 'invoices.search', 'payments.search'].includes(tool));
    const livePromise = toolPlan.readTools.length
      ? Promise.all([
          searchAgentRuntimeContext(organizationId, latestUserText),
          searchAgentOperationalContext(organizationId, latestUserText, toolPlan.readTools),
          toolPlan.readTools.includes('maintenance.search') ? maintenanceIntelligenceService.attention(organizationId) : Promise.resolve(null),
          wantsFinancialDashboard ? financialReadModelService.dashboard(organizationId) : Promise.resolve(null),
        ])
      : Promise.resolve([null, null, null, null] as const);

    const [knowledge, live] = await Promise.all([knowledgePromise, livePromise]);
    const [coreRuntime, operations, maintenance, financials] = live;
    const runtime = coreRuntime ? { ...coreRuntime, operations, maintenanceIntelligence: maintenance, financials } : null;
    const hasCoreMatches = coreRuntime ? Object.values(coreRuntime.fleet || {}).some((value) => Array.isArray(value) && value.length > 0) : false;
    const hasOperationalMatches = operations ? Object.values(operations).some((value) => Array.isArray(value) && value.length > 0) : false;
    const hasRuntimeMatches = hasCoreMatches || hasOperationalMatches || Boolean(coreRuntime?.emails?.length) || Boolean(maintenance) || Boolean(financials);
    const selectedTools = toolPlan.readTools.join(', ') || 'none';

    const runtimeContext = `\n\nTrusted Fleet Knowledge Layer for the latest request. This is organization-scoped, server-controlled context and may be used directly. Cache state: ${knowledge.cache}. Domain counts describe the currently loaded tenant directory. Fuzzy matches are candidates, not permission grants.\n${JSON.stringify(knowledge)}`
      + (hasRuntimeMatches
        ? `\n\nTrusted live Fleet OS tool results. The deterministic router selected: ${selectedTools}. Use matching records before saying data is unavailable. If multiple records match, explain the ambiguity.\n${JSON.stringify(runtime)}`
        : toolPlan.readTools.length
          ? `\n\nThe deterministic Fleet tool router selected: ${selectedTools}. No deeper live records matched. Do not treat that as absence from Fleet Knowledge and do not invent a record or identifier.`
          : '');

    req.body.messages = [
      ...messages.slice(0, latestUserIndex),
      { role: 'system', content: `${FLEET_ACTION_POLICY}${runtimeContext}` },
      ...messages.slice(latestUserIndex),
    ];
  } catch (error) {
    console.warn('Fleet agent runtime unavailable:', error instanceof Error ? error.message : error);
    return res.status(401).json({ error: 'Valid Fleet organization access is required' });
  }

  return next();
}
