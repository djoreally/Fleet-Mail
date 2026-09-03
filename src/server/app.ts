import express, { type NextFunction, type Request, type Response } from 'express';
import { apiRouter } from './routes/api.js';
import { googleRouter } from './routes/google.js';
import { agentmailCrudRouter } from './routes/agentmailCrud.js';
import { agentActionsRouter } from './routes/agentActions.js';
import { operationsRouter } from './routes/operations.js';
import { customerPartsRouter } from './routes/customerParts.js';
import { scheduleDispatchRouter } from './routes/scheduleDispatch.js';
import { financialDocumentsRouter } from './routes/financialDocuments.js';
import { financialReadModelRouter } from './routes/financialReadModel.js';
import { paymentReconciliationRouter } from './routes/paymentReconciliation.js';
import { vehicle360Router } from './routes/vehicle360.js';
import { workOrderExecutionRouter } from './routes/workOrderExecution.js';
import { workOrderCompletionRouter } from './routes/workOrderCompletion.js';
import { maintenanceIntelligenceRouter } from './routes/maintenanceIntelligence.js';
import { prospectingRouter } from './routes/prospecting.js';
import { prospectWebhookService, verifyAgentMailWebhook } from './services/prospectWebhook.js';
import { fleetAgentRuntimeMiddleware } from './services/fleetAgentRuntime.js';
import { chatAttachmentExtractionMiddleware } from './services/chatAttachmentExtraction.js';
import { fleetAuthFailure, requireFleetOrganization } from './services/fleetAuth.js';
import { enforceAgentMailInboxScope, resolveOrganizationAgentMailInbox } from './services/agentMailTenantBoundary.js';
import { serverConfig } from './config.js';

async function requireFleetSession(req: Request, res: Response, next: NextFunction) {
  try {
    await requireFleetOrganization(req);
    return next();
  } catch (error) {
    return fleetAuthFailure(res, error);
  }
}

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

  // Public health contract exposes only provider readiness. Authenticated app
  // sessions additionally receive their own organization-scoped active inbox.
  app.get('/api/status', async (req, res) => {
    const atlasKey = process.env.ATLASCLOUD_API_KEY;
    const agentKey = process.env.AGENTMAIL_API_KEY;
    const status: Record<string, unknown> = {
      atlasCloudConfigured: Boolean(atlasKey && atlasKey !== 'your-atlascloud-api-key' && atlasKey.trim() !== ''),
      agentMailConfigured: Boolean(agentKey && agentKey !== 'your-agentmail-api-key' && agentKey.trim() !== ''),
      neonConfigured: Boolean(serverConfig.neonDataApiUrl && serverConfig.neonAuthUrl),
      googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN_ENCRYPTION_KEY),
      firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY?.trim()),
      browserbaseConfigured: Boolean(process.env.BROWSERBASE_API_KEY?.trim()),
    };
    if (req.header('authorization')?.startsWith('Bearer ')) {
      try {
        const activeInbox = await resolveOrganizationAgentMailInbox(req);
        status.defaultInbox = activeInbox;
        status.activeInbox = activeInbox;
      } catch {
        // Health status remains available even when the current session has no inbox yet.
      }
    }
    return res.json(status);
  });

  // AI and communications surfaces can expose tenant data or cause external side
  // effects. They must always enter through a verified Fleet session.
  app.use('/api/chat', requireFleetSession);
  app.use('/api/rewrite-tone', requireFleetSession);
  app.use('/api/generate-draft', requireFleetSession);
  app.use('/api/summarize-email', requireFleetSession);
  app.use('/api/agentmail', requireFleetSession);
  app.use('/api/agentmail', enforceAgentMailInboxScope);

  app.use('/api/chat', chatAttachmentExtractionMiddleware);
  app.use('/api/chat', fleetAgentRuntimeMiddleware);

  app.use('/api', apiRouter);
  app.use('/api', vehicle360Router);
  app.use('/api/google', googleRouter);
  app.use('/api/agentmail/crud', agentmailCrudRouter);
  app.use('/api/agent/actions', agentActionsRouter);
  app.use('/api/operations', operationsRouter);
  app.use('/api/operations', customerPartsRouter);
  app.use('/api/operations', maintenanceIntelligenceRouter);
  app.use('/api/operations', workOrderCompletionRouter);
  app.use('/api/operations', workOrderExecutionRouter);
  app.use('/api/operations', prospectingRouter);
  app.use('/api/fleet-operations', scheduleDispatchRouter);
  app.use('/api/fleet', paymentReconciliationRouter);
  app.use('/api/fleet', financialReadModelRouter);
  app.use('/api/fleet', financialDocumentsRouter);

  return app;
}
