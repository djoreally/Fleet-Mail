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
import { fleetAgentRuntimeMiddleware } from './services/fleetAgentRuntime.js';

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

  app.use('/api/chat', fleetAgentRuntimeMiddleware);

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
