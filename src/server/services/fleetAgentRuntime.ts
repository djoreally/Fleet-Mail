import type { NextFunction, Request, Response } from 'express';
import { requireFleetOrganization } from './fleetAuth.js';
import { resolveAgentRuntimeOrganization, searchAgentRuntimeContext } from './agentRuntimeSearch.js';
import { planAgentTools } from './agentToolRouter.js';

const FLEET_ACTION_POLICY = `Fleet OS agent tool policy.

Live reads are organization-scoped and may be used directly when present in the trusted runtime results below.
All Fleet writes are proposals only. Never claim a Fleet record was created, changed, scheduled, approved, rejected, or completed until the confirmed action executor returns success.

When the user asks to create a work order, prepare exactly one reviewable action block:
\`\`\`json:agent_action
{"kind":"fleet.work_order.create","payload":{"vehicleId":"vehicle-id","complaint":"requested service","requestedServices":["service"],"purchaseOrderNumber":"optional","odometer":0,"engineHours":0,"scheduledAt":"optional ISO-8601","priority":"routine","customerNotes":"optional","technicianNotes":"optional"}}
\`\`\`

When the user asks to change a work-order lifecycle state, prepare exactly one reviewable action block:
\`\`\`json:agent_action
{"kind":"fleet.work_order.transition","payload":{"workOrderId":"work-order-id","status":"target_status"}}
\`\`\`

When the user asks to approve or reject a service authorization, prepare exactly one reviewable action block:
\`\`\`json:agent_action
{"kind":"fleet.authorization.decision","payload":{"authorizationId":"authorization-id","decision":"authorized","authorizedBy":"optional","authorizationMethod":"optional","purchaseOrderNumber":"optional","notes":"optional"}}
\`\`\`

Use canonical IDs from trusted runtime data. If the requested record is ambiguous or no canonical ID is available, ask for the minimum clarification instead of guessing. Never construct organization IDs, customer IDs, vehicle IDs, work-order IDs, authorization IDs, or contact IDs.`;

function latestUserMessageIndex(messages: unknown[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { role?: unknown } | null;
    if (message?.role === 'user') return index;
  }
  return -1;
}

async function resolveOrganization(req: Request) {
  if (req.header('authorization')?.startsWith('Bearer ')) {
    try {
      return await requireFleetOrganization(req);
    } catch {
      // Inbox resolution is a constrained fallback for the existing AgentMail runtime.
    }
  }
  return resolveAgentRuntimeOrganization(String(req.body?.contextInbox || ''));
}

export async function fleetAgentRuntimeMiddleware(req: Request, _res: Response, next: NextFunction) {
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

    const runtime = await searchAgentRuntimeContext(organizationId, latestUserText);
    const hasFleetMatches = Object.values(runtime.fleet || {}).some((value) => Array.isArray(value) && value.length > 0);
    const hasRuntimeMatches = hasFleetMatches || runtime.emails.length > 0;
    const selectedTools = toolPlan.readTools.join(', ');

    const runtimeContext = hasRuntimeMatches
      ? `\n\nTrusted Fleet OS tool results for the latest request. The deterministic router selected: ${selectedTools}. These results are live and organization-scoped. Use matching records before saying data is unavailable. If multiple records match, explain the ambiguity.\n${JSON.stringify(runtime)}`
      : `\n\nThe deterministic Fleet tool router selected: ${selectedTools}. No matching live Fleet or AgentMail records were found for the latest request. Do not invent a record or identifier.`;

    const contextMessage = {
      role: 'system',
      content: `${FLEET_ACTION_POLICY}${runtimeContext}`,
    };

    req.body.messages = [
      ...messages.slice(0, latestUserIndex),
      contextMessage,
      ...messages.slice(latestUserIndex),
    ];
  } catch (error) {
    console.warn('Fleet agent runtime unavailable:', error instanceof Error ? error.message : error);
  }

  return next();
}
