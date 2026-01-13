import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getIssuer(supabaseUrl: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
}

function getJwks(supabaseUrl: string) {
  if (jwks) return jwks;
  const url = supabaseUrl.replace(/\/$/, '');
  jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  return jwks;
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<{ userId: string }> {
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');

  const { payload } = await jwtVerify(accessToken, getJwks(supabaseUrl), {
    issuer: getIssuer(supabaseUrl),
    audience: 'authenticated',
  });

  const userId = payload.sub;
  if (!userId) throw new Error('Invalid JWT: missing sub');
  return { userId };
}

export function getBearerTokenFromHeader(value: string | undefined | null): string {
  const v = String(value ?? '').trim();
  const m = v.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? '';
}
