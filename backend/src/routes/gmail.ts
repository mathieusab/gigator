import type { Request, Response } from 'express';
import { Router } from 'express';
import { listThreadsForEmail } from '../proxy/gmail';

export const gmailRouter = Router();

gmailRouter.get('/threads', async (req: Request, res: Response) => {
  const email = String(req.query.email ?? '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Missing required query param: email' });
  }

  const clientId = process.env.GMAIL_PROXY_CLIENT_ID ?? '';
  const clientSecret = process.env.GMAIL_PROXY_CLIENT_SECRET ?? '';
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Gmail proxy is not configured' });
  }

  const threads = await listThreadsForEmail({ clientId, clientSecret }, email);
  return res.json(threads);
});
