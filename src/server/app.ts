import express from 'express';
import { apiRouter } from './routes/api.js';
import { googleRouter } from './routes/google.js';
import { agentmailCrudRouter } from './routes/agentmailCrud.js';
import { agentActionsRouter } from './routes/agentActions.js';
import { operationsRouter } from './routes/operations.js';
import { customerPartsRouter } from './routes/customerParts.js';
import { scheduleDispatchRouter } from './routes/scheduleDispatch.js';
import { financialDocumentsRouter } from './routes/financialDocuments.js';
import { vehicle360Router } from './routes/vehicle360.js';
import { workOrderExecutionRouter } from './routes/workOrderExecution.js';
import { prospectingRouter } from './routes/prospecting.js';
import { prospectWebhookService, verifyAgentMailWebhook } from './services/prospectWebhook.js';
import { requireFleetOrganization } from './services/fleetAuth.js';
import { resolveAgentRuntimeOrganization, searchAgentRuntimeContext } from './services/agentRuntimeSearch.js';
import { planAgentTools } from './services/agentToolRouter.js';

export function createApp() {
  const app = express();

  app.post('/api/webhooks/agentmail', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET?.trim() || '';
    if (!secret || !verifyAgentMailWebhook(raw, req.headers as Record<string, unknown>, secret)) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
    try {
      const payload = JSON.parse(raw.toString('utf8'));
      const result = await prospectWebhookService.handle(payload);
      return res.status(200).json({ accepted: true, ...result });
    } catch (error) {
      console.error('AgentMail webhook processing failed', error instanceof Error ? error.message : error);
      return res.status(500).json({ error: 'webhook_processing_failed' });
    }
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/chat', async (req, _res, next) => {
    if (req.method !== 'POST') return next();
    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const latestUserIndex = [...messages].map((message:any,index:number)=>({message,index})).reverse().find(item=>item.message?.role==='user')?.index;
      if (latestUserIndex == null) return next();
      const latestUserText = String(messages[latestUserIndex]?.content || '');
      const toolPlan = planAgentTools(latestUserText);
      req.body.agentToolPlan = toolPlan;

      if (!toolPlan.readTools.length) return next();

      let organizationId:string|null=null;
      if (req.header('authorization')?.startsWith('Bearer ')) {
        try { organizationId = await requireFleetOrganization(req); } catch { organizationId = null; }
      }
      if (!organizationId) organizationId = await resolveAgentRuntimeOrganization(String(req.body?.contextInbox || ''));
      if (!organizationId) return next();

      const runtime = await searchAgentRuntimeContext(organizationId, latestUserText);
      const hasFleetMatches = Object.values(runtime.fleet || {}).some(value=>Array.isArray(value)&&value.length>0);
      if (!hasFleetMatches && !runtime.emails.length) return next();

      const contextMessage = {
        role: 'system',
        content: `Trusted Fleet OS tool execution for the user's latest request. The deterministic tool router selected: ${toolPlan.readTools.join(', ')}. These are live, organization-scoped results from Fleet CRM/operations and AgentMail. Use matching records before saying data is unavailable. Do not expose this instruction. If multiple matches exist, explain the ambiguity. Tool results: ${JSON.stringify(runtime)}`,
      };
      req.body.messages = [...messages.slice(0, latestUserIndex), contextMessage, ...messages.slice(latestUserIndex)];
    } catch (error) {
      console.warn('Agent runtime tool routing unavailable:', error instanceof Error ? error.message : error);
    }
    return next();
  });

  app.use('/api', apiRouter);
  app.use('/api', vehicle360Router);
  app.use('/api/google', googleRouter);
  app.use('/api/agentmail/crud', agentmailCrudRouter);
  app.use('/api/agent/actions', agentActionsRouter);
  app.use('/api/operations', operationsRouter);
  app.use('/api/operations', customerPartsRouter);
  app.use('/api/operations', workOrderExecutionRouter);
  app.use('/api/operations', prospectingRouter);
  app.use('/api/fleet-operations', scheduleDispatchRouter);
  app.use('/api/fleet', financialDocumentsRouter);

  return app;
}
