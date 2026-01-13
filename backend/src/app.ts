import cors from 'cors';
import express from 'express';

import { gmailRouter } from './routes/gmail.js';
import { mapsRouter } from './routes/maps.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/gmail', gmailRouter);
  app.use('/maps', mapsRouter);

  return app;
}
