import {
  entriesToList,
  loadFreezeData,
  summarizeEntries,
  syncEntrevistaFreeze,
} from './_shared/freeze.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * GET  → lê o congelamento (Blob do site, persiste entre deploys)
 * POST → dispara sync (com debounce de 10 min) — útil quando alguém abre o app
 */
export default async (req: Request) => {
  try {
    if (req.method === 'POST') {
      const result = await syncEntrevistaFreeze({ minIntervalMs: 10 * 60 * 1000 });
      const data = await loadFreezeData();
      return json({
        ok: true,
        sync: result,
        lastSyncAt: data.lastSyncAt,
        updatedAt: data.updatedAt,
        totals: summarizeEntries(data.entries),
        entryCount: Object.keys(data.entries).length,
      });
    }

    if (req.method !== 'GET') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    const data = await loadFreezeData();
    const entries = entriesToList(data.entries);

    return json({
      ok: true,
      version: data.version,
      lastSyncAt: data.lastSyncAt,
      updatedAt: data.updatedAt,
      totals: summarizeEntries(data.entries),
      entryCount: entries.length,
      entries,
    });
  } catch (error) {
    console.error('entrevista-freeze error', error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro no freeze',
      },
      500
    );
  }
};
