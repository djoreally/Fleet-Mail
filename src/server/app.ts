import express from 'express';
import { apiRouter } from './routes/api';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', apiRouter);

  return app;
}
