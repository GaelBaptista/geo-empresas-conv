import { getStore } from '@netlify/blobs';

export const BASE = 'https://apiminivagas.estagius.com.br/api';
export const STORE_NAME = 'entrevista-freeze';
export const BLOB_KEY = 'entries-v1';

export const ENTREVISTA_STATUSES = [
  'entrevista_presencial',
  'entrevista_online',
  'entrevista',
];

export const OUTCOME_STATUSES = [
  'contratado',
  'reprovado_empresa',
  'nao_compareceu_empresa',
];

/**
 * Token Minivagas — SOMENTE Functions Netlify / Node (nunca importar em src/ do Vite).
 * Preferência: MINIVAGAS_TOKEN no painel Netlify.
 * Fallback de deploy: existe para o ranking funcionar sem configurar o painel;
 * o browser NÃO recebe esse valor (só o Bearer nas chamadas server→API).
 */
const SERVER_ONLY_FALLBACK =
  '767|pqnnUDfnxdVt6chJ2M1nR6GH0KRBf5PZUZdJ1Nslfe2a0a68';

export function readToken() {
  const raw =
    process.env.MINIVAGAS_TOKEN ||
    process.env.VITE_PUBLIC_TOKEN ||
    process.env.VITE_MINIVAGAS_TOKEN ||
    SERVER_ONLY_FALLBACK ||
    '';
  return String(raw).trim().replace(/^["']|["']$/g, '');
}

export function normalizeCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 12 && digits.length < 14) return digits.padStart(14, '0');
  return digits;
}

export function entryKey(candidatoId, jobPostingId) {
  return `${candidatoId}:${jobPostingId ?? 0}`;
}

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function unwrapPaginated(payload) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      meta: { currentPage: 1, lastPage: 1, total: payload.length },
    };
  }
  if (!payload || typeof payload !== 'object') {
    return { items: [], meta: { currentPage: 1, lastPage: 1, total: 0 } };
  }

  const obj = payload;
  let items = [];
  if (Array.isArray(obj.data)) items = obj.data;
  else if (Array.isArray(obj.candidatos)) items = obj.candidatos;

  const metaObj =
    obj.meta && typeof obj.meta === 'object' ? obj.meta : obj;

  const currentPage =
    asNumber(metaObj.current_page) ?? asNumber(metaObj.currentPage) ?? 1;
  const lastPage =
    asNumber(metaObj.last_page) ??
    asNumber(metaObj.lastPage) ??
    asNumber(metaObj.total_pages) ??
    1;
  const total = asNumber(metaObj.total) ?? asNumber(obj.count) ?? items.length;

  return {
    items,
    meta: {
      currentPage,
      lastPage: Math.max(1, lastPage),
      total,
    },
  };
}

async function fetchPage(token, status, page) {
  const url = new URL(`${BASE}/candidatos/status/${status}`);
  url.searchParams.set('page', String(page));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(`Minivagas ${status} HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return unwrapPaginated(await res.json());
}

/** Busca todas as páginas (com teto para caber no limite de 30s da scheduled function). */
export async function fetchAllByStatus(token, status, maxPages = 80) {
  const first = await fetchPage(token, status, 1);
  const items = [...first.items];
  const lastPage = Math.min(first.meta.lastPage, maxPages);

  for (let page = 2; page <= lastPage; page++) {
    const next = await fetchPage(token, status, page);
    items.push(...next.items);
    if (next.items.length === 0) break;
  }

  return { items, reportedTotal: first.meta.total };
}

export async function fetchStatusOptional(token, status) {
  try {
    return await fetchAllByStatus(token, status);
  } catch (error) {
    if (error?.status === 404) return { items: [], reportedTotal: 0, missing: true };
    throw error;
  }
}

function candidatoCnpj(item) {
  return (
    normalizeCnpj(item?.job_posting?.cnpj) || normalizeCnpj(item?.cnpj) || ''
  );
}

function emptyStore() {
  return {
    version: 1,
    updatedAt: null,
    lastSyncAt: null,
    entries: {},
  };
}

export function getFreezeStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export async function loadFreezeData() {
  const store = getFreezeStore();
  const data = await store.get(BLOB_KEY, { type: 'json' });
  if (!data || typeof data !== 'object') return emptyStore();
  return {
    version: 1,
    updatedAt: data.updatedAt || null,
    lastSyncAt: data.lastSyncAt || null,
    entries:
      data.entries && typeof data.entries === 'object' ? data.entries : {},
  };
}

export async function saveFreezeData(data) {
  const store = getFreezeStore();
  await store.setJSON(BLOB_KEY, data);
}

function upsertInterview(entries, item, sourceStatus, nowIso) {
  const id = asNumber(item?.id);
  if (id == null) return false;
  const jobPostingId = asNumber(item?.job_posting_id ?? item?.job_posting?.id) ?? 0;
  const key = entryKey(id, jobPostingId);
  const existing = entries[key];
  const cnpj = candidatoCnpj(item);
  const companyName = String(item?.job_posting?.company_name || '').trim();

  if (!existing) {
    entries[key] = {
      candidatoId: id,
      jobPostingId,
      cnpj,
      companyName,
      fullName: String(item?.full_name || '').trim(),
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      sourceStatus,
      outcome: null,
      outcomeAt: null,
      updatedAtApi: item?.updated_at || item?.created_at || null,
    };
    return true;
  }

  existing.lastSeenAt = nowIso;
  if (sourceStatus) existing.sourceStatus = sourceStatus;
  if (cnpj) existing.cnpj = cnpj;
  if (companyName) existing.companyName = companyName;
  if (item?.full_name) existing.fullName = String(item.full_name).trim();
  existing.updatedAtApi = item?.updated_at || existing.updatedAtApi || null;
  return false;
}

function upsertOutcome(entries, item, outcome, nowIso) {
  const id = asNumber(item?.id);
  if (id == null) return { created: false, updated: false };
  const jobPostingId = asNumber(item?.job_posting_id ?? item?.job_posting?.id) ?? 0;
  const key = entryKey(id, jobPostingId);
  const existing = entries[key];
  const cnpj = candidatoCnpj(item);
  const companyName = String(item?.job_posting?.company_name || '').trim();
  const outcomeAt = item?.updated_at || item?.created_at || nowIso;

  if (!existing) {
    entries[key] = {
      candidatoId: id,
      jobPostingId,
      cnpj,
      companyName,
      fullName: String(item?.full_name || '').trim(),
      firstSeenAt: outcomeAt,
      lastSeenAt: nowIso,
      sourceStatus: 'seeded_from_outcome',
      outcome,
      outcomeAt,
      updatedAtApi: item?.updated_at || item?.created_at || null,
    };
    return { created: true, updated: false };
  }

  const changed = existing.outcome !== outcome;
  existing.outcome = outcome;
  existing.outcomeAt = outcomeAt;
  existing.lastSeenAt = nowIso;
  if (cnpj) existing.cnpj = cnpj;
  if (companyName) existing.companyName = companyName;
  if (item?.full_name) existing.fullName = String(item.full_name).trim();
  existing.updatedAtApi = item?.updated_at || existing.updatedAtApi || null;
  return { created: false, updated: changed };
}

/**
 * Congela entrevistas (append-only) e atualiza desfechos finais.
 * Store do site — sobrevive a deploys.
 */
export async function syncEntrevistaFreeze(options = {}) {
  const token = readToken();
  if (!token) {
    throw new Error('Token Minivagas não configurado (MINIVAGAS_TOKEN ou VITE_PUBLIC_TOKEN).');
  }

  const minIntervalMs = options.minIntervalMs ?? 0;
  const data = await loadFreezeData();
  const now = Date.now();

  if (
    minIntervalMs > 0 &&
    data.lastSyncAt &&
    now - new Date(data.lastSyncAt).getTime() < minIntervalMs
  ) {
    return {
      skipped: true,
      reason: 'synced_recently',
      lastSyncAt: data.lastSyncAt,
      totals: summarizeEntries(data.entries),
    };
  }

  const nowIso = new Date(now).toISOString();
  const entries = { ...data.entries };
  let interviewsAdded = 0;
  let outcomesCreated = 0;
  let outcomesUpdated = 0;
  const fetched = {};

  for (const status of ENTREVISTA_STATUSES) {
    const result = await fetchStatusOptional(token, status);
    fetched[status] = {
      count: result.items.length,
      missing: Boolean(result.missing),
    };
    for (const item of result.items) {
      if (upsertInterview(entries, item, status, nowIso)) interviewsAdded += 1;
    }
  }

  for (const status of OUTCOME_STATUSES) {
    const result = await fetchStatusOptional(token, status);
    fetched[status] = {
      count: result.items.length,
      missing: Boolean(result.missing),
    };
    for (const item of result.items) {
      const { created, updated } = upsertOutcome(entries, item, status, nowIso);
      if (created) outcomesCreated += 1;
      if (updated) outcomesUpdated += 1;
    }
  }

  const next = {
    version: 1,
    updatedAt: nowIso,
    lastSyncAt: nowIso,
    entries,
  };
  await saveFreezeData(next);

  return {
    skipped: false,
    lastSyncAt: nowIso,
    interviewsAdded,
    outcomesCreated,
    outcomesUpdated,
    entryCount: Object.keys(entries).length,
    fetched,
    totals: summarizeEntries(entries),
  };
}

export function summarizeEntries(entries) {
  const totals = {
    total: 0,
    emFunil: 0,
    contratados: 0,
    reprovados: 0,
    naoCompareceu: 0,
  };
  for (const entry of Object.values(entries || {})) {
    totals.total += 1;
    if (entry.outcome === 'contratado') totals.contratados += 1;
    else if (entry.outcome === 'reprovado_empresa') totals.reprovados += 1;
    else if (entry.outcome === 'nao_compareceu_empresa') totals.naoCompareceu += 1;
    else totals.emFunil += 1;
  }
  return totals;
}

export function entriesToList(entries) {
  return Object.values(entries || {});
}
