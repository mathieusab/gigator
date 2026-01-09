// app/backend/lib/oauth_state_store.ts
// Lightweight OAuth state store with Redis (preferred) and in-memory fallback.
// Exports:
// - persistOauthState(state: string, meta: any, ttlSeconds?: number): Promise<void>
// - getOauthState(state: string): Promise<any | null>
// - deleteOauthState(state: string): Promise<void>
// - isUsingRedis(): boolean
//
// Behavior:
// - If REDIS_URL is set, attempts to connect to Redis (node-redis v4 client).
// - If Redis not available or REDIS_URL not set, falls back to an in-memory Map (not for production).
// - Default TTL: 600 seconds (10 minutes) configurable via OAUTH_STATE_TTL env var.
//
// Usage example:
//   await persistOauthState(state, { profileId: '123' });
//   const meta = await getOauthState(state);
//   await deleteOauthState(state);

// app/backend/lib/oauth_state_store.ts
// Note: repo already has Node typings (see [`tsconfig.json`](tsconfig.json:8)).
import type { RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL ?? '';
const MIN_TTL_SECONDS = 600; // AC requires >= 10 minutes
const DEFAULT_TTL_RAW = Number(process.env.OAUTH_STATE_TTL ?? String(MIN_TTL_SECONDS));
const DEFAULT_TTL_UNCLAMPED =
  Number.isFinite(DEFAULT_TTL_RAW) && DEFAULT_TTL_RAW > 0 ? DEFAULT_TTL_RAW : MIN_TTL_SECONDS;
const DEFAULT_TTL = Math.max(DEFAULT_TTL_UNCLAMPED, MIN_TTL_SECONDS); // seconds

let redisClient: RedisClientType | null = null;
let usingRedis = false;
let redisInitError: string | null = null;

// In-memory fallback store: Map<state, { meta: any, expiresAt: number }>
const memStore = new Map<string, { meta: any; expiresAt: number }>();

async function initRedis() {
  if (!REDIS_URL) return;
  try {
    // Dynamic import keeps startup lightweight; in tests we often force mem-store via REDIS_URL="".
    const { createClient } = await import('redis');
    redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();
    usingRedis = true;
    redisInitError = null;
  } catch (err) {
    // Fail closed when REDIS_URL is configured but Redis is unavailable.
    // In production/multi-instance setups, an in-memory fallback would break state validation.
    redisClient = null;
    usingRedis = false;
    redisInitError = err instanceof Error ? err.message : String(err);
  }
}

// Ensure redis is initialized lazily
let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = initRedis();
  }
  return initPromise;
}

async function ensureReadyForOperation(): Promise<void> {
  await ensureInit();
  if (REDIS_URL && !usingRedis) {
    // Keep provider details out of the error message to reduce the risk of leaking connection info.
    // Logging should still capture the underlying failure separately (via redisInitError).
    throw new Error('oauth_state_store: Redis required but unavailable');
  }
}

function purgeExpiredMemEntries(nowMs = Date.now()): void {
  for (const [key, value] of memStore.entries()) {
    if (nowMs > value.expiresAt) memStore.delete(key);
  }
}

/**
 * Persist an oauth state with optional TTL.
 * @param state - opaque random string
 * @param meta - metadata object (e.g., { profileId, createdAt })
 * @param ttlSeconds - seconds to live (defaults to DEFAULT_TTL)
 */
export async function persistOauthState(state: string, meta: any, ttlSeconds?: number): Promise<void> {
  const ttlRaw = typeof ttlSeconds === 'number' ? ttlSeconds : DEFAULT_TTL;
  const ttlUnclamped = Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : DEFAULT_TTL;
  const ttl = Math.max(ttlUnclamped, MIN_TTL_SECONDS);
  await ensureReadyForOperation();

  if (usingRedis && redisClient) {
    try {
      await redisClient.setEx(`oauth:state:${state}`, ttl, JSON.stringify(meta || {}));
      return;
    } catch (err) {
      throw new Error(`oauth_state_store: Redis setEx failed (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  // Only allowed when REDIS_URL is not configured.
  purgeExpiredMemEntries();
  const expiresAt = Date.now() + ttl * 1000;
  memStore.set(state, { meta: meta || {}, expiresAt });
}

/**
 * Retrieve persisted oauth state metadata. Returns null if not found or expired.
 * @param state
 */
export async function getOauthState(state: string): Promise<any | null> {
  await ensureReadyForOperation();

  if (usingRedis && redisClient) {
    try {
      const v = await redisClient.get(`oauth:state:${state}`);
      if (!v) return null;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    } catch (err) {
      throw new Error(`oauth_state_store: Redis get failed (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  purgeExpiredMemEntries();
  const r = memStore.get(state);
  if (!r) return null;
  if (Date.now() > r.expiresAt) {
    memStore.delete(state);
    return null;
  }
  return r.meta;
}

/**
 * Delete an oauth state (used after validation).
 * @param state
 */
export async function deleteOauthState(state: string): Promise<void> {
  await ensureReadyForOperation();

  if (usingRedis && redisClient) {
    try {
      await redisClient.del(`oauth:state:${state}`);
      return;
    } catch (err) {
      throw new Error(`oauth_state_store: Redis del failed (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  memStore.delete(state);
}

/** Returns true if Redis is being used as the backing store. */
export function isUsingRedis(): boolean {
  return usingRedis;
}

// Optional: graceful shutdown helper
export async function shutdownOauthStateStore(): Promise<void> {
  if (redisClient && usingRedis) {
    try {
      await redisClient.disconnect();
    } catch {
      // ignore
    }
  }
}