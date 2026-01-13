import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gmailRouter } from './routes/gmail';

// When running from a pnpm workspace, the backend may be started with CWD at the repo root
// or at ./backend. Load common `.env` locations (if present). Values already present in the
// environment are not overridden.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 1) Repo root: <repo>/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// 2) Backend-specific: <repo>/backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// 3) Optional backend env file (some setups use this naming)
dotenv.config({ path: path.resolve(__dirname, '../.env.backend') });

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/gmail', gmailRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});
