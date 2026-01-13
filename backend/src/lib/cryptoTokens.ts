import crypto from 'node:crypto';

function parseKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Missing encryption key');

  // Accept either 32-byte base64 or 64-hex.
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  const buf = Buffer.from(trimmed, 'base64');
  if (buf.length !== 32) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64) or 64 hex chars');
  }
  return buf;
}

export type EncryptedToken = {
  ciphertextB64: string;
  ivB64: string;
  tagB64: string;
};

export function encryptToken(plain: string, keyRaw: string): EncryptedToken {
  const key = parseKey(keyRaw);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertextB64: ciphertext.toString('base64'),
    ivB64: iv.toString('base64'),
    tagB64: tag.toString('base64'),
  };
}

export function decryptToken(enc: EncryptedToken, keyRaw: string): string {
  const key = parseKey(keyRaw);
  const iv = Buffer.from(enc.ivB64, 'base64');
  const tag = Buffer.from(enc.tagB64, 'base64');
  const ciphertext = Buffer.from(enc.ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

export function hmacSha256Base64Url(payload: string, secret: string): string {
  const h = crypto.createHmac('sha256', secret);
  h.update(payload);
  return h.digest('base64url');
}
