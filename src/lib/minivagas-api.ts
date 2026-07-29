import axios from 'axios';

const BASE = 'https://apiminivagas.estagius.com.br/api';
const TOKEN =
  (import.meta.env.VITE_PUBLIC_TOKEN as string | undefined) ||
  (import.meta.env.VITE_MINIVAGAS_TOKEN as string | undefined) ||
  '';

const CACHE_TTL_MS = 30_000;

const client = axios.create({
  baseURL: BASE,
  headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
});

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const responseCache = new Map<string, CacheEntry<unknown>>();

function getCacheKey(path: string, params?: Record<string, unknown>) {
  return `${path}:${JSON.stringify(params || {})}`;
}

export function isMinivagasConfigured(): boolean {
  return Boolean(TOKEN);
}

export async function getEstagius<T>(
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  if (!TOKEN) {
    throw new Error('Token Minivagas não configurado (VITE_PUBLIC_TOKEN).');
  }

  const key = getCacheKey(path, params);
  const now = Date.now();
  const cached = responseCache.get(key);

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value as T;
  }

  if (cached?.promise) {
    return cached.promise as Promise<T>;
  }

  const promise = client
    .get<T>(path, { params })
    .then((response) => {
      const value = response.data;
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
