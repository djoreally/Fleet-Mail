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

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', apiRouter);
  app.use('/api', vehicle360Router);
  app.use('/api/google', googleRouter);
  app.use('/api/agentmail/crud', agentmailCrudRouter);
  app.use('/api/agent/actions', agentActionsRouter);
  app.use('/api/operations', operationsRouter);
  app.use('/api/operations', customerPartsRouter);
  app.use('/api/operations', workOrderExecutionRouter);
  app.use('/api/fleet-operations', scheduleDispatchRouter);
  app.use('/api/fleet', financialDocumentsRouter);

  return app;
}
