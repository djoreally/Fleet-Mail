import express from 'express';
import { apiRouter } from './routes/api.js';
import { googleRouter } from './routes/google.js';
import { agentmailCrudRouter } from './routes/agentmailCrud.js';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', apiRouter);
  app.use('/api/google', googleRouter);
  app.use('/api/agentmail/crud', agentmailCrudRouter);

  return app;
}
