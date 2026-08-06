import type { Config } from '@netlify/functions';

/**
 * Proxy Nominatim (server-side) — evita CORS e rate limit no browser.
 * GET /.netlify/functions/geocode-search?q=Rua+X,+Centro,+Fortaleza
 */
export default async (req: Request) => {
  try {
    if (req.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 5 || q.length > 200) {
      return json({ error: 'invalid q' }, 400);
    }

    const target = new URL('https://nominatim.openstreetmap.org/search');
    target.searchParams.set('format', 'json');
    target.searchParams.set('limit', '5');
    target.searchParams.set('countrycodes', 'br');
    target.searchParams.set('addressdetails', '1');
    target.searchParams.set('q', q);

    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'geo-empresas-conv/1.0 (netlify geocode proxy)',
      },
    });

    if (!upstream.ok) {
      return json({ error: `nominatim ${upstream.status}` }, 502);
    }

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'geocode error';
    return json({ error: message }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const config: Config = {
  // sob demanda; sem schedule
};
