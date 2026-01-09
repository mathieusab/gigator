// app/backend/lib/jwt.ts
// Minimal JWT (HS256) implementation for app sessions.

import crypto from 'crypto';

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  // Node supports 'base64url' directly (18+).
  return buf.toString('base64url');
}

function base64UrlDecodeToString(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export type JwtSignOptions = {
  expiresInSeconds?: number;
};

export function signJwt(payload: Record<string, any>, secret: string, options?: JwtSignOptions): string {
  const header = { alg: 'HS256', typ: 'JWT' };

  const now = Math.floor(Date.now() / 1000);
  const ttl = options?.expiresInSeconds ?? 60 * 60 * 24; // 24h

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + ttl
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

export function verifyJwt(token: string, secret: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid_token');

  const [headerB64, payloadB64, signatureB64] = parts;

  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');

  if (!timingSafeEqual(signatureB64, expectedSig)) {
    throw new Error('invalid_token');
  }

  const headerJson = JSON.parse(base64UrlDecodeToString(headerB64));
  if (headerJson?.alg !== 'HS256') throw new Error('invalid_token');

  const payloadJson = JSON.parse(base64UrlDecodeToString(payloadB64));

  const now = Math.floor(Date.now() / 1000);
  if (typeof payloadJson?.exp !== 'number') {
    throw new Error('invalid_token');
  }
  if (now >= payloadJson.exp) {
    throw new Error('jwt_expired');
  }

  return payloadJson;
}
