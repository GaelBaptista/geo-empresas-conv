/**
 * Cliente DrVagas — o browser NUNCA envia o token.
 * Dev:  Vite middleware /api/drvagas (token no Node via .env)
 * Prod: Function Netlify (token só no servidor)
 */

const CACHE_TTL_MS = 30_000;

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const responseCache = new Map<string, CacheEntry<unknown>>();

function getCacheKey(path: string, params?: Record<string, unknown>) {
  return `${path}:${JSON.stringify(params || {})}`;
}

/** Sempre tenta o proxy same-origin (token escondido no servidor). */
export function isDrvagasConfigured(): boolean {
  return true;
}

function normalizeApiPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Paths do proxy — produção usa Function; se falhar tenta /api (rewrite). */
function proxyCandidates(): string[] {
  if (import.meta.env.PROD) {
    return [
      '/.netlify/functions/drvagas-proxy',
      '/api/drvagas',
    ];
  }
  return ['/api/drvagas'];
}

async function fetchViaOneProxy<T>(
  base: string,
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  const qs = new URLSearchParams();
  qs.set('path', normalizeApiPath(path));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null) continue;
      qs.set(key, String(value));
    }
  }
  const res = await fetch(`${base}?${qs.toString()}`);
  if (!res.ok) {
    let detail = '';
    try {
      const errBody = (await res.json()) as { error?: string };
      detail = errBody?.error ? `: ${errBody.error}` : '';
    } catch {
      /* ignore */
    }
    throw new Error(`DrVagas proxy HTTP ${res.status}${detail}`);
  }
  return (await res.json()) as T;
}

async function fetchViaProxy<T>(
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  const bases = proxyCandidates();
  let lastError: unknown;
  for (const base of bases) {
    try {
      return await fetchViaOneProxy<T>(base, path, params);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('DrVagas proxy indisponível');
}

export async function getEstagius<T>(
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  const key = getCacheKey(path, params);
  const now = Date.now();
  const cached = responseCache.get(key);

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value as T;
  }

  if (cached?.promise) {
    return cached.promise as Promise<T>;
  }

  const promise = fetchViaProxy<T>(path, params)
    .then((value) => {
      responseCache.set(key, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return value;
    })
    .catch((error) => {
      responseCache.delete(key);
      throw error;
    });

  responseCache.set(key, {
    promise,
    expiresAt: now + CACHE_TTL_MS,
  });

  return promise;
}
