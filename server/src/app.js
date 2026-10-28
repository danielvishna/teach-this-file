/**
 * @fileoverview Builds the Express app (middleware + routes) without
 * starting a listener, so it can be imported directly by tests (via
 * supertest) and by index.js, which is the only place that calls
 * `app.listen`. Keeping these separate avoids binding a real port in
 * every test run.
 */
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './openapi.js';
import { planRouter } from './routes/plan.js';
import { smokeTestRouter } from './routes/smokeTest.js';
import { tutorTurnRouter } from './routes/tutorTurn.js';

/**
 * @return {import('express').Express} A configured Express app, not yet
 *     listening on any port.
 */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/smoke-test', smokeTestRouter);
  app.use('/api/plan', planRouter);
  app.use('/api/tutor-turn', tutorTurnRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/openapi.json', (_req, res) => {
    res.json(openapiSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

  return app;
}
