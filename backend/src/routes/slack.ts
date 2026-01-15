import type { Request, Response } from 'express';
import { Router } from 'express';

import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { getBearerTokenFromHeader, verifySupabaseAccessToken } from '../lib/supabaseJwt.js';
import { postSlackConcertUpdate, type SlackConcertAction } from '../lib/slack.js';

export const slackRouter = Router();

class SlackProxyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function requireActiveAppUserId(req: Request): Promise<string> {
  const token = getBearerTokenFromHeader(req.header('authorization'));
  if (!token) throw new SlackProxyError(401, 'Missing Authorization Bearer token');

  const { userId } = await verifySupabaseAccessToken(token);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_users')
    .select('id,is_active')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.is_active) throw new SlackProxyError(403, 'Access denied');

  return userId;
}

type ConcertPayload = {
  id?: string | null;
  title?: string | null;
  venue_name?: string | null;
  city?: string | null;
  date_start?: string | null;
  status?: string | null;
};

type ConcertUpdateBody = {
  action?: SlackConcertAction;
  concert?: ConcertPayload;
};

slackRouter.post('/concert-update', async (req: Request, res: Response) => {
  try {
    const userId = await requireActiveAppUserId(req);

    const body = (req.body ?? {}) as ConcertUpdateBody;
    const action = String(body.action ?? '').trim() as SlackConcertAction;
    if (action !== 'created' && action !== 'updated' && action !== 'deleted') {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const concert = (body.concert ?? {}) as ConcertPayload;

    // Best-effort: never block user flows on Slack.
    await postSlackConcertUpdate({ action, concert, actorUserId: userId }).catch((e) => {
      console.warn('Failed to send Slack concert update:', e);
    });

    return res.status(204).send();
  } catch (e) {
    if (e instanceof SlackProxyError) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Slack proxy error' });
  }
});
