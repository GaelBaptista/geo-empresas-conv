import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const UPSTREAM = 'https://apiminivagas.estagius.com.br/api';

function isAllowedMinivagasPath(apiPath: string): boolean {
  if (!apiPath.startsWith('/')) return false;
  if (apiPath.includes('..') || apiPath.includes('//') || apiPath.includes('\\')) {
    return false;
  }
  if (apiPath === '/users') return true;
  if (apiPath === '/processos_seletivos') return true;
  if (/^\/candidatos\/status\/[a-z0-9_]+$/i.test(apiPath)) return true;
  return false;
}

/** Proxy Minivagas no dev: token só no Node (lê .env), nunca no browser. */
function minivagasDevProxy(): Plugin {
  return {
    name: 'minivagas-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = req.url || '';
          if (!url.startsWith('/api/minivagas')) return next();
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          // Preferência: recarrega env a cada request (token sem reiniciar dev server)
          const env = loadEnv(server.config.mode, server.config.envDir || process.cwd(), '');
          const token = String(
            env.MINIVAGAS_TOKEN ||
              env.VITE_PUBLIC_TOKEN ||
              env.VITE_MINIVAGAS_TOKEN ||
              process.env.MINIVAGAS_TOKEN ||
              process.env.VITE_PUBLIC_TOKEN ||
              process.env.VITE_MINIVAGAS_TOKEN ||
              ''
          )
            .trim()
            .replace(/^["']|["']$/g, '');

          if (!token) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error:
                  'Token Minivagas ausente. Coloque VITE_PUBLIC_TOKEN ou MINIVAGAS_TOKEN no .env e reinicie o npm run dev.',
              })
            );
            return;
          }

          const parsed = new URL(url, 'http://localhost');
          let apiPath = (parsed.searchParams.get('path') || '').trim();
          if (apiPath && !apiPath.startsWith('/')) apiPath = `/${apiPath}`;
          if (!isAllowedMinivagasPath(apiPath)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'path não permitido' }));
            return;
          }

          const target = new URL(`${UPSTREAM}${apiPath}`);
          for (const [key, value] of parsed.searchParams.entries()) {
            if (key === 'path') continue;
            if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
            if (value.length > 64) continue;
            target.searchParams.set(key, value);
          }

          const upstream = await fetch(target, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const body = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader(
            'Content-Type',
            upstream.headers.get('Content-Type') || 'application/json; charset=utf-8'
          );
          res.setHeader('Cache-Control', 'private, max-age=15');
          res.end(body);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'proxy error',
            })
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Carrega .env no processo do Vite (só servidor; não vaza pro bundle).
  loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), minivagasDevProxy()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        // Nominatim não libera CORS; no dev usamos proxy local.
        '/api/nominatim': {
          target: 'https://nominatim.openstreetmap.org',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/nominatim/, ''),
          headers: {
            'User-Agent': 'gestao-visitas-fortaleza/1.0 (dev proxy)',
          },
        },
      },
    },
  };
});
