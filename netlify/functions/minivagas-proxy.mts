import { BASE, readToken } from './_shared/freeze.mjs';

/**
 * Proxy GET Minivagas — token só em variáveis de ambiente do Netlify.
 * O front NÃO deve embutir o token no bundle.
 *
 * Query:
 *   path  = rota da API (ex.: /users ou /candidatos/status/contratado)
 *   page  = paginação (opcional; demais params são repassados se simples)
 */

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, max-age=15',
    },
  });
}

/** Só paths de leitura usados pelo app. */
function isAllowedPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.includes('..') || path.includes('//') || path.includes('\\')) return false;
  if (path === '/users') return true;
  if (/^\/candidatos\/status\/[a-z0-9_]+$/i.test(path)) return true;
  return false;
}

export default async (req: Request) => {
  try {
    if (req.method !== 'GET') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    const token = readToken();
    if (!token) {
      return json(
        {
          ok: false,
          error:
            'Token Minivagas não configurado no servidor (MINIVAGAS_TOKEN ou VITE_PUBLIC_TOKEN no painel Netlify).',
        },
        503
      );
    }

    const url = new URL(req.url);
    let path = (url.searchParams.get('path') || '').trim();
    if (path && !path.startsWith('/')) path = `/${path}`;

    if (!isAllowedPath(path)) {
      return json({ ok: false, error: 'path não permitido' }, 400);
    }

    const target = new URL(`${BASE}${path}`);
    for (const [key, value] of url.searchParams.entries()) {
      if (key === 'path') continue;
      // só query simples (page, etc.)
      if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
      if (value.length > 64) continue;
      target.searchParams.set(key, value);
    }

    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'private, max-age=15',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'proxy error';
    return json({ ok: false, error: message }, 500);
  }
};
