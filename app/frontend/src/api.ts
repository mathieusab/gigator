export type ApiError = {
  status: number;
  error?: string;
  message?: string;
};

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    },
    credentials: 'include'
  });

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    const err: ApiError = {
      status: res.status,
      error: body?.error,
      message: body?.message
    };
    throw err;
  }

  // Some endpoints can return empty bodies.
  const body = await parseJsonSafe(res);
  return body as T;
}

export async function getMe(): Promise<{ id: string; email: string; full_name?: string | null; avatar_url?: string | null }> {
  return apiFetch('/api/me');
}

export async function startAppLogin(): Promise<{ oauth_url: string }> {
  return apiFetch('/api/auth/google/start', { method: 'POST' });
}
