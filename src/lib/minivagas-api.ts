import axios from 'axios';

const UPSTREAM_BASE = 'https://apiminivagas.estagius.com.br/api';
const PROXY_PATH = '/.netlify/functions/minivagas-proxy';

function readMinivagasToken(): string {
  // Só em dev — em produção o token NÃO deve ir no bundle (proxy Netlify).
  if (!import.meta.env.DEV) return '';
  const raw =
    (import.meta.env.VITE_PUBLIC_TOKEN as string | undefined) ||
    (import.meta.env.VITE_MINIVAGAS_TOKEN as string | undefined) ||
    '';
  return String(raw).trim().replace(/^["']|["']$/g, '');
}

/**
 * Em produção o token fica só no Netlify (Function proxy).
 * Em dev local usa VITE_PUBLIC_TOKEN no .env e chama a API direto.
 */
function useServerProxy(): boolean {
  if (import.meta.env.PROD) return true;
  return !readMinivagasToken();
}

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

export function isMinivagasConfigured(): boolean {
  // Produção: proxy no servidor (configurado com MINIVAGAS_TOKEN no painel).
  if (import.meta.env.PROD) return true;
  // Dev: precisa de token no .env (ou netlify dev com env do servidor).
  return Boolean(readMinivagasToken());
}

function normalizeApiPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return p;
}

async function fetchViaProxy<T>(
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
  const res = await fetch(`${PROXY_PATH}?${qs.toString()}`);
  if (!res.ok) {
    let detail = '';
    try {
      const errBody = (await res.json()) as { error?: string };
      detail = errBody?.error ? `: ${errBody.error}` : '';
    } catch {
      /* ignore */
    }
    throw new Error(`Minivagas proxy HTTP ${res.status}${detail}`);
  }
  return (await res.json()) as T;
}

async function fetchDirect<T>(
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  const TOKEN = readMinivagasToken();
  if (!TOKEN) {
    throw new Error(
      'Token Minivagas não configurado. Defina VITE_PUBLIC_TOKEN no .env local.'
    );
  }

  const client = axios.create({
    baseURL: UPSTREAM_BASE,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const response = await client.get<T>(path, { params });
  return response.data;
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

  const promise = (useServerProxy()
    ? fetchViaProxy<T>(path, params)
    : fetchDirect<T>(path, params)
  )
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
