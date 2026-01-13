import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './app.js';

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

// createApp already wires cors/json and routes; keep index.ts as the
// process entrypoint responsible for env loading and HTTP listen.
const app = createApp();

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});
