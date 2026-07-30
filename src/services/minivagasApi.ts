import { getEstagius, isMinivagasConfigured } from '@/lib/minivagas-api';
import type { Company } from '@/types';
import {
  fetchEntrevistaFreeze,
  triggerEntrevistaFreezeSync,
  type FreezeEntry,
} from '@/services/entrevistaFreezeApi';

/** Status finais do funil pós-entrevista (ranking + reputação). */
export type CandidatoStatusFinal =
  | 'reprovado_empresa'
  | 'contratado'
  | 'nao_compareceu_empresa';

/** Tags de entrevista que o freeze acumula. */
export const ENTREVISTA_STATUSES = [
  'entrevista_presencial',
  'entrevista_online',
  'entrevista',
] as const;

export type MinivagasUser = {
  id: number;
  name: string;
  email?: string | null;
  cnpj?: string | null;
  cnpjs?: string[] | null;
  role?: string | null;
  observacoes?: string | null;
};

export type MinivagasCandidato = {
  id: number;
  job_posting_id?: number;
  full_name?: string;
  status?: string;
  cnpj?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  job_posting?: {
    id?: number;
    company_name?: string | null;
    cnpj?: string | null;
    data_entrevista?: string | null;
  } | null;
};

export type ReputationLabel =
  | 'Excelente'
  | 'Boa'
  | 'Regular'
  | 'Atenção'
  | 'Crítica'
  | 'Sem dados';

export type CompanyReputation = {
  enviados: number;
  emFunil: number;
  contratados: number;
  reprovados: number;
  naoCompareceu: number;
  decididos: number;
  hireRate: number | null;
  rejectRate: number | null;
  noShowRate: number | null;
  /** 0–100 com base na taxa de contratação entre decididos */
  score: number | null;
  label: ReputationLabel;
};

export type CompanyMinivagasExtras = {
  observacoes: string | null;
  reprovados: number;
  contratados: number;
  naoCompareceu: number;
  reprovadosMes: number;
  contratadosMes: number;
  naoCompareceuMes: number;
  enviados: number;
  emFunil: number;
  reputation: CompanyReputation | null;
  minivagasName?: string;
};

export type HiringRankRow = {
  cnpjDigits: string;
  companyId: string | null;
  companyName: string;
  count: number;
  onMap: boolean;
};

export type ReputationRankRow = {
  /** Chave do grupo (`group-123`) ou empresa sola (`solo-CNPJ`). */
  groupKey: string;
  groupId: number | null;
  memberCount: number;
  cnpjDigits: string;
  companyId: string | null;
  companyName: string;
  onMap: boolean;
  reputation: CompanyReputation;
};

export type HiringPeriod = 'all' | 'month';

type Counts = {
  reprovados: number;
  contratados: number;
  naoCompareceu: number;
  emFunil: number;
  name: string;
};

type CountField = keyof Omit<Counts, 'name'>;

type PageMeta = {
  currentPage: number;
  lastPage: number;
  total: number | null;
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function unwrapPaginated<T>(payload: unknown): { items: T[]; meta: PageMeta } {
  if (Array.isArray(payload)) {
    return {
      items: payload as T[],
      meta: { currentPage: 1, lastPage: 1, total: payload.length },
    };
  }

  if (!payload || typeof payload !== 'object') {
    return { items: [], meta: { currentPage: 1, lastPage: 1, total: 0 } };
  }

  const obj = payload as Record<string, unknown>;
  let items: T[] = [];
  if (Array.isArray(obj.data)) items = obj.data as T[];
  else if (Array.isArray(obj.users)) items = obj.users as T[];
  else if (Array.isArray(obj.candidatos)) items = obj.candidatos as T[];

  const metaObj =
    obj.meta && typeof obj.meta === 'object'
      ? (obj.meta as Record<string, unknown>)
      : obj;

  const currentPage =
    asNumber(metaObj.current_page) ?? asNumber(metaObj.currentPage) ?? 1;
  const lastPage =
    asNumber(metaObj.last_page) ??
    asNumber(metaObj.lastPage) ??
    asNumber(metaObj.total_pages) ??
    1;
  // Algumas rotas Minivagas devolvem tudo numa página com `count`
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

async function fetchAllPages<T>(
  path: string,
  maxPages = 400
): Promise<{ items: T[]; reportedTotal: number | null }> {
  const first = unwrapPaginated<T>(await getEstagius<unknown>(path, { page: 1 }));
  const items = [...first.items];
  const lastPage = Math.min(first.meta.lastPage, maxPages);

  for (let page = 2; page <= lastPage; page++) {
    const next = unwrapPaginated<T>(await getEstagius<unknown>(path, { page }));
    items.push(...next.items);
    if (next.items.length === 0) break;
  }

  return {
    items,
    reportedTotal: first.meta.total,
  };
}

export function normalizeCnpj(value: string | null | undefined): string {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 12 && digits.length < 14) return digits.padStart(14, '0');
  return digits;
}

function allUserCnpjs(user: MinivagasUser): string[] {
  const set = new Set<string>();
  const main = normalizeCnpj(user.cnpj);
  if (main.length >= 11) set.add(main);
  for (const raw of user.cnpjs || []) {
    const digits = normalizeCnpj(raw);
    if (digits.length >= 11) set.add(digits);
  }
  return Array.from(set);
}

function candidatoCnpj(item: MinivagasCandidato): string {
  return normalizeCnpj(item.job_posting?.cnpj) || normalizeCnpj(item.cnpj) || '';
}

function normalizeStatus(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterCandidatosByStatus(
  list: MinivagasCandidato[],
  status: string
): MinivagasCandidato[] {
  const expected = normalizeStatus(status);
  return list.filter((item) => {
    const s = normalizeStatus(item.status);
    if (!s) return true;
    return s === expected || s.includes(expected);
  });
}

function isInCurrentMonth(item: MinivagasCandidato, now = new Date()): boolean {
  const raw = item.updated_at || item.created_at || '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function filterCandidatosByPeriod(
  list: MinivagasCandidato[],
  period: HiringPeriod
): MinivagasCandidato[] {
  if (period === 'all') return list;
  return list.filter((item) => isInCurrentMonth(item));
}

export async function fetchMinivagasUsers(): Promise<MinivagasUser[]> {
  const { items } = await fetchAllPages<MinivagasUser>('/users');
  return items;
}

export async function fetchCandidatosByStatus(
  status: string
): Promise<{ items: MinivagasCandidato[]; reportedTotal: number | null }> {
  const { items, reportedTotal } = await fetchAllPages<MinivagasCandidato>(
    `/candidatos/status/${status}`
  );
  return {
    items: filterCandidatosByStatus(items, status),
    reportedTotal,
  };
}

/** Tenta status de entrevista; se a rota não existir, ignora. */
async function fetchEntrevistaStatuses(): Promise<MinivagasCandidato[]> {
  const results = await Promise.allSettled(
    ENTREVISTA_STATUSES.map((status) => fetchCandidatosByStatus(status))
  );

  const byKey = new Map<string, MinivagasCandidato>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value.items) {
      const jobId = item.job_posting_id ?? item.job_posting?.id ?? 0;
      byKey.set(`${item.id}:${jobId}`, item);
    }
  }
  return Array.from(byKey.values());
}

export function buildObservacoesByCnpj(users: MinivagasUser[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const user of users) {
    const obs = (user.observacoes || '').trim();
    if (!obs) continue;
    for (const cnpj of allUserCnpjs(user)) {
      if (!map.has(cnpj)) map.set(cnpj, obs);
    }
  }
  return map;
}

function emptyCounts(name = ''): Counts {
  return { reprovados: 0, contratados: 0, naoCompareceu: 0, emFunil: 0, name };
}

function accumulateCandidates(
  list: MinivagasCandidato[],
  field: CountField,
  byCnpj: Map<string, Counts>
) {
  for (const item of list) {
    const cnpj = candidatoCnpj(item);
    if (cnpj.length < 11) continue;
    const name = (item.job_posting?.company_name || '').trim() || `CNPJ ${cnpj}`;
    const current = byCnpj.get(cnpj) || emptyCounts(name);
    current[field] += 1;
    if (!current.name || current.name.startsWith('CNPJ ')) current.name = name;
    byCnpj.set(cnpj, current);
  }
}

export function buildHiringStatsByCnpj(
  reprovados: MinivagasCandidato[],
  contratados: MinivagasCandidato[],
  naoCompareceu: MinivagasCandidato[] = [],
  pipeline: MinivagasCandidato[] = []
): Map<string, Counts> {
  const byCnpj = new Map<string, Counts>();
  accumulateCandidates(reprovados, 'reprovados', byCnpj);
  accumulateCandidates(contratados, 'contratados', byCnpj);
  accumulateCandidates(naoCompareceu, 'naoCompareceu', byCnpj);
  accumulateCandidates(pipeline, 'emFunil', byCnpj);
  return byCnpj;
}

export function computeReputation(counts: Counts): CompanyReputation {
  const contratados = counts.contratados;
  const reprovados = counts.reprovados;
  const naoCompareceu = counts.naoCompareceu;
  const emFunil = counts.emFunil;
  const decididos = contratados + reprovados + naoCompareceu;
  const enviados = decididos + emFunil;

  if (decididos === 0 && enviados === 0) {
    return {
      enviados: 0,
      emFunil: 0,
      contratados: 0,
      reprovados: 0,
      naoCompareceu: 0,
      decididos: 0,
      hireRate: null,
      rejectRate: null,
      noShowRate: null,
      score: null,
      label: 'Sem dados',
    };
  }

  const hireRate = decididos > 0 ? contratados / decididos : null;
  const rejectRate = decididos > 0 ? reprovados / decididos : null;
  const noShowRate = decididos > 0 ? naoCompareceu / decididos : null;
  const score = hireRate != null ? Math.round(hireRate * 100) : null;

  let label: ReputationLabel = 'Sem dados';
  if (hireRate == null) {
    label = enviados > 0 ? 'Regular' : 'Sem dados';
  } else if (hireRate >= 0.4) label = 'Excelente';
  else if (hireRate >= 0.25) label = 'Boa';
  else if (hireRate >= 0.15) label = 'Regular';
  else if (hireRate >= 0.08) label = 'Atenção';
  else label = 'Crítica';

  return {
    enviados,
    emFunil,
    contratados,
    reprovados,
    naoCompareceu,
    decididos,
    hireRate,
    rejectRate,
    noShowRate,
    score,
    label,
  };
}

export function countByCnpj(
  list: MinivagasCandidato[]
): Map<string, { count: number; name: string }> {
  const map = new Map<string, { count: number; name: string }>();
  for (const item of list) {
    const cnpj = candidatoCnpj(item);
    if (cnpj.length < 11) continue;
    const name = (item.job_posting?.company_name || '').trim() || `CNPJ ${cnpj}`;
    const current = map.get(cnpj) || { count: 0, name };
    current.count += 1;
    if (current.name.startsWith('CNPJ ')) current.name = name;
    map.set(cnpj, current);
  }
  return map;
}

export function extrasForCompany(
  company: Company,
  observacoesByCnpj: Map<string, string>,
  hiringByCnpj: Map<string, Counts>,
  hiringByCnpjMonth: Map<string, Counts>,
  reputationByCnpj?: Map<string, Counts> | null,
  reputationByCnpjMonth?: Map<string, Counts> | null
): CompanyMinivagasExtras | null {
  const digits = normalizeCnpj(company.cnpj);
  if (!digits) return null;

  const observacoes = observacoesByCnpj.get(digits) || null;
  const hiring = hiringByCnpj.get(digits);
  const hiringMonth = hiringByCnpjMonth.get(digits);
  const reputationCounts =
    reputationByCnpj?.get(digits) || hiring || null;
  const reputationCountsMonth =
    reputationByCnpjMonth?.get(digits) || hiringMonth || null;

  if (!observacoes && !hiring && !hiringMonth && !reputationCounts) return null;

  const reputation = reputationCounts ? computeReputation(reputationCounts) : null;

  return {
    observacoes,
    reprovados: hiring?.reprovados ?? 0,
    contratados: hiring?.contratados ?? 0,
    naoCompareceu: hiring?.naoCompareceu ?? 0,
    reprovadosMes: hiringMonth?.reprovados ?? 0,
    contratadosMes: hiringMonth?.contratados ?? 0,
    naoCompareceuMes: hiringMonth?.naoCompareceu ?? 0,
    enviados: reputation?.enviados ?? 0,
    emFunil: reputation?.emFunil ?? 0,
    reputation,
    minivagasName:
      reputationCounts?.name || hiring?.name || hiringMonth?.name || reputationCountsMonth?.name,
  };
}

export function buildSingleSideRanking(
  companies: Company[],
  list: MinivagasCandidato[],
  limit = 20
): HiringRankRow[] {
  const companyByCnpj = new Map<string, Company>();
  for (const company of companies) {
    const digits = normalizeCnpj(company.cnpj);
    if (digits) companyByCnpj.set(digits, company);
  }

  const counts = countByCnpj(list);
  const rows: HiringRankRow[] = [];

  for (const [cnpjDigits, data] of counts.entries()) {
    if (data.count <= 0) continue;
    const matched = companyByCnpj.get(cnpjDigits);
    rows.push({
      cnpjDigits,
      companyId: matched?.id ?? null,
      companyName: matched ? matched.tradeName || matched.name : data.name,
      count: data.count,
      onMap: Boolean(matched),
    });
  }

  return rows
    .sort((a, b) => b.count - a.count || a.companyName.localeCompare(b.companyName, 'pt-BR'))
    .slice(0, limit);
}

function groupKeyForCompany(company: Company | undefined, cnpjDigits: string): string {
  if (company?.groupId != null) return `group-${company.groupId}`;
  return `solo-${cnpjDigits}`;
}

function groupLabelForCompany(company: Company | undefined, fallbackName: string): string {
  if (company?.groupId != null) {
    return company.groupName?.trim() || `Grupo ${company.groupId}`;
  }
  if (company) return company.tradeName || company.name;
  return fallbackName;
}

/**
 * Contagens de reputação por GRUPO:
 * - contratados / reprovado_empresa / nao_compareceu_empresa
 * - emFunil = ainda em entrevista (freeze ou snapshot ao vivo)
 */
export function buildReputationStatsByGroup(
  companies: Company[],
  reprovadosEmpresa: MinivagasCandidato[],
  contratados: MinivagasCandidato[],
  naoCompareceu: MinivagasCandidato[],
  emEntrevista: MinivagasCandidato[]
): Map<string, Counts> {
  const companyByCnpj = new Map<string, Company>();
  for (const company of companies) {
    const digits = normalizeCnpj(company.cnpj);
    if (digits) companyByCnpj.set(digits, company);
  }

  const byGroup = new Map<string, Counts>();

  const add = (list: MinivagasCandidato[], field: CountField) => {
    for (const item of list) {
      const cnpj = candidatoCnpj(item);
      if (cnpj.length < 11) continue;
      const company = companyByCnpj.get(cnpj);
      const key = groupKeyForCompany(company, cnpj);
      const name = groupLabelForCompany(
        company,
        (item.job_posting?.company_name || '').trim() || `CNPJ ${cnpj}`
      );
      const current = byGroup.get(key) || emptyCounts(name);
      current[field] += 1;
      if (!current.name || current.name.startsWith('CNPJ ')) current.name = name;
      byGroup.set(key, current);
    }
  };

  add(reprovadosEmpresa, 'reprovados');
  add(contratados, 'contratados');
  add(naoCompareceu, 'naoCompareceu');
  add(emEntrevista, 'emFunil');

  return byGroup;
}

function freezeEntriesToCandidatos(
  entries: FreezeEntry[],
  outcome: FreezeEntry['outcome'] | 'em_funil'
): MinivagasCandidato[] {
  return entries
    .filter((entry) => {
      if (outcome === 'em_funil') return !entry.outcome;
      return entry.outcome === outcome;
    })
    .map((entry) => ({
      id: entry.candidatoId,
      job_posting_id: entry.jobPostingId,
      full_name: entry.fullName,
      status: entry.outcome || entry.sourceStatus || 'entrevista',
      cnpj: entry.cnpj,
      created_at: entry.firstSeenAt,
      updated_at: entry.outcomeAt || entry.lastSeenAt || entry.updatedAtApi,
      job_posting: {
        id: entry.jobPostingId,
        company_name: entry.companyName,
        cnpj: entry.cnpj,
      },
    }));
}

function isFreezeEntryInMonth(entry: FreezeEntry, now = new Date()): boolean {
  const raw = entry.outcomeAt || entry.lastSeenAt || entry.firstSeenAt || entry.updatedAtApi || '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

/** Espelha a contagem do grupo em cada CNPJ membro (para ficha da empresa). */
export function expandGroupStatsToCnpjs(
  companies: Company[],
  hiringByGroup: Map<string, Counts>
): Map<string, Counts> {
  const byCnpj = new Map<string, Counts>();
  for (const company of companies) {
    const digits = normalizeCnpj(company.cnpj);
    if (!digits) continue;
    const key = groupKeyForCompany(company, digits);
    const counts = hiringByGroup.get(key);
    if (counts) byCnpj.set(digits, counts);
  }
  return byCnpj;
}

/** Ranking de reputação por GRUPO (taxa após entrevista presencial). */
export function buildReputationRanking(
  companies: Company[],
  hiringByGroup: Map<string, Counts>,
  options?: { minDecided?: number; limit?: number }
): ReputationRankRow[] {
  const minDecided = options?.minDecided ?? 5;
  const limit = options?.limit ?? 20;

  const membersByGroup = new Map<string, Company[]>();
  for (const company of companies) {
    const digits = normalizeCnpj(company.cnpj);
    if (!digits) continue;
    const key = groupKeyForCompany(company, digits);
    const list = membersByGroup.get(key) || [];
    list.push(company);
    membersByGroup.set(key, list);
  }

  const rows: ReputationRankRow[] = [];
  for (const [groupKey, counts] of hiringByGroup.entries()) {
    const reputation = computeReputation(counts);
    if ((reputation.decididos || 0) < minDecided) continue;
    if (reputation.hireRate == null) continue;

    const members = membersByGroup.get(groupKey) || [];
    const representative =
      [...members].sort(
        (a, b) => (b.activeTrainees ?? 0) - (a.activeTrainees ?? 0)
      )[0] || null;
    const groupId = groupKey.startsWith('group-')
      ? Number(groupKey.replace('group-', ''))
      : null;

    rows.push({
      groupKey,
      groupId: Number.isFinite(groupId) ? groupId : null,
      memberCount: Math.max(1, members.length),
      cnpjDigits: normalizeCnpj(representative?.cnpj) || groupKey,
      companyId: representative?.id ?? null,
      companyName: counts.name,
      onMap: Boolean(representative),
      reputation,
    });
  }

  return rows
    .sort(
      (a, b) =>
        (b.reputation.hireRate ?? 0) - (a.reputation.hireRate ?? 0) ||
        b.reputation.decididos - a.reputation.decididos
    )
    .slice(0, limit);
}

export type StatusTotals = {
  reprovados: number;
  contratados: number;
  naoCompareceu: number;
  emFunil: number;
  enviados: number;
  reprovadosMes: number;
  contratadosMes: number;
  naoCompareceuMes: number;
  apiTotalReprovados: number | null;
  apiTotalContratados: number | null;
  apiTotalNaoCompareceu: number | null;
  freezeEntryCount: number;
  freezeLastSyncAt: string | null;
};

export type MinivagasBundle = {
  observacoesByCnpj: Map<string, string>;
  hiringByCnpj: Map<string, Counts>;
  hiringByCnpjMonth: Map<string, Counts>;
  /** Contagens de reputação (pós-entrevista) espelhadas por CNPJ do grupo. */
  reputationByCnpj: Map<string, Counts>;
  reputationByCnpjMonth: Map<string, Counts>;
  topRejecters: HiringRankRow[];
  topHired: HiringRankRow[];
  topNoShows: HiringRankRow[];
  topRejectersMonth: HiringRankRow[];
  topHiredMonth: HiringRankRow[];
  topNoShowsMonth: HiringRankRow[];
  topReputation: ReputationRankRow[];
  topReputationMonth: ReputationRankRow[];
  matchedObservacoes: number;
  matchedHiring: number;
  totals: StatusTotals;
};

export function rankingsForPeriod(
  bundle: MinivagasBundle,
  period: HiringPeriod
): {
  topRejecters: HiringRankRow[];
  topHired: HiringRankRow[];
  topNoShows: HiringRankRow[];
  topReputation: ReputationRankRow[];
} {
  if (period === 'month') {
    return {
      topRejecters: bundle.topRejectersMonth,
      topHired: bundle.topHiredMonth,
      topNoShows: bundle.topNoShowsMonth,
      topReputation: bundle.topReputationMonth,
    };
  }
  return {
    topRejecters: bundle.topRejecters,
    topHired: bundle.topHired,
    topNoShows: bundle.topNoShows,
    topReputation: bundle.topReputation,
  };
}

export function reputationTone(label: ReputationLabel): string {
  switch (label) {
    case 'Excelente':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800';
    case 'Boa':
      return 'text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-200 dark:bg-teal-950/50 dark:border-teal-800';
    case 'Regular':
      return 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-100 dark:bg-amber-950/40 dark:border-amber-800';
    case 'Atenção':
      return 'text-orange-800 bg-orange-50 border-orange-200 dark:text-orange-100 dark:bg-orange-950/40 dark:border-orange-800';
    case 'Crítica':
      return 'text-rose-800 bg-rose-50 border-rose-200 dark:text-rose-100 dark:bg-rose-950/40 dark:border-rose-800';
    default:
      return 'text-muted-foreground bg-muted border-border';
  }
}

export async function loadMinivagasBundle(companies: Company[]): Promise<MinivagasBundle | null> {
  if (!isMinivagasConfigured()) return null;

  // Backup: se alguém abrir o app, tenta sync (debounce 10 min no servidor)
  triggerEntrevistaFreezeSync();

  const [
    users,
    reprovadosEmpresaRes,
    contratadosRes,
    naoCompareceuRes,
    entrevistaLive,
    freezePayload,
  ] = await Promise.all([
    fetchMinivagasUsers(),
    fetchCandidatosByStatus('reprovado_empresa'),
    fetchCandidatosByStatus('contratado'),
    fetchCandidatosByStatus('nao_compareceu_empresa'),
    fetchEntrevistaStatuses(),
    fetchEntrevistaFreeze(),
  ]);

  const freezeEntries = freezePayload?.entries || [];
  const useFreeze = freezeEntries.length > 0;

  const reprovadosEmpresa = useFreeze
    ? freezeEntriesToCandidatos(freezeEntries, 'reprovado_empresa')
    : reprovadosEmpresaRes.items;
  const contratados = useFreeze
    ? freezeEntriesToCandidatos(freezeEntries, 'contratado')
    : contratadosRes.items;
  const naoCompareceu = useFreeze
    ? freezeEntriesToCandidatos(freezeEntries, 'nao_compareceu_empresa')
    : naoCompareceuRes.items;
  const emEntrevista = useFreeze
    ? freezeEntriesToCandidatos(freezeEntries, 'em_funil')
    : entrevistaLive;

  // Volume por empresa: tags ao vivo (mais legível no ranking de volume)
  const volumeReprovados = reprovadosEmpresaRes.items;
  const volumeContratados = contratadosRes.items;
  const volumeNaoCompareceu = naoCompareceuRes.items;
  const volumeEntrevista = entrevistaLive;

  const freezeMonth = freezeEntries.filter((e) => isFreezeEntryInMonth(e));
  const reprovadosMes = useFreeze
    ? freezeEntriesToCandidatos(freezeMonth, 'reprovado_empresa')
    : filterCandidatosByPeriod(reprovadosEmpresa, 'month');
  const contratadosMes = useFreeze
    ? freezeEntriesToCandidatos(freezeMonth, 'contratado')
    : filterCandidatosByPeriod(contratados, 'month');
  const naoCompareceuMes = useFreeze
    ? freezeEntriesToCandidatos(freezeMonth, 'nao_compareceu_empresa')
    : filterCandidatosByPeriod(naoCompareceu, 'month');
  const entrevistaMes = useFreeze
    ? freezeEntriesToCandidatos(freezeMonth, 'em_funil')
    : filterCandidatosByPeriod(emEntrevista, 'month');

  const volumeReprovadosMes = filterCandidatosByPeriod(volumeReprovados, 'month');
  const volumeContratadosMes = filterCandidatosByPeriod(volumeContratados, 'month');
  const volumeNaoCompareceuMes = filterCandidatosByPeriod(volumeNaoCompareceu, 'month');
  const volumeEntrevistaMes = filterCandidatosByPeriod(volumeEntrevista, 'month');

  const observacoesByCnpj = buildObservacoesByCnpj(users);

  const hiringByCnpj = buildHiringStatsByCnpj(
    volumeReprovados,
    volumeContratados,
    volumeNaoCompareceu,
    volumeEntrevista
  );
  const hiringByCnpjMonth = buildHiringStatsByCnpj(
    volumeReprovadosMes,
    volumeContratadosMes,
    volumeNaoCompareceuMes,
    volumeEntrevistaMes
  );

  const reputationByGroup = buildReputationStatsByGroup(
    companies,
    reprovadosEmpresa,
    contratados,
    naoCompareceu,
    emEntrevista
  );
  const reputationByGroupMonth = buildReputationStatsByGroup(
    companies,
    reprovadosMes,
    contratadosMes,
    naoCompareceuMes,
    entrevistaMes
  );
  const reputationByCnpj = expandGroupStatsToCnpjs(companies, reputationByGroup);
  const reputationByCnpjMonth = expandGroupStatsToCnpjs(companies, reputationByGroupMonth);

  const companyCnpjs = new Set(
    companies.map((c) => normalizeCnpj(c.cnpj)).filter((d) => d.length >= 11)
  );

  let matchedObservacoes = 0;
  let matchedHiring = 0;
  for (const digits of companyCnpjs) {
    if (observacoesByCnpj.has(digits)) matchedObservacoes += 1;
    if (hiringByCnpj.has(digits) || hiringByCnpjMonth.has(digits)) matchedHiring += 1;
  }

  return {
    observacoesByCnpj,
    hiringByCnpj,
    hiringByCnpjMonth,
    reputationByCnpj,
    reputationByCnpjMonth,
    topRejecters: buildSingleSideRanking(companies, volumeReprovados),
    topHired: buildSingleSideRanking(companies, volumeContratados),
    topNoShows: buildSingleSideRanking(companies, volumeNaoCompareceu),
    topRejectersMonth: buildSingleSideRanking(companies, volumeReprovadosMes),
    topHiredMonth: buildSingleSideRanking(companies, volumeContratadosMes),
    topNoShowsMonth: buildSingleSideRanking(companies, volumeNaoCompareceuMes),
    topReputation: buildReputationRanking(companies, reputationByGroup),
    topReputationMonth: buildReputationRanking(companies, reputationByGroupMonth, {
      minDecided: 3,
    }),
    matchedObservacoes,
    matchedHiring,
    totals: {
      reprovados: volumeReprovados.length,
      contratados: volumeContratados.length,
      naoCompareceu: volumeNaoCompareceu.length,
      emFunil: useFreeze ? emEntrevista.length : volumeEntrevista.length,
      enviados: useFreeze
        ? freezeEntries.length
        : volumeContratados.length +
          volumeReprovados.length +
          volumeNaoCompareceu.length +
          volumeEntrevista.length,
      reprovadosMes: volumeReprovadosMes.length,
      contratadosMes: volumeContratadosMes.length,
      naoCompareceuMes: volumeNaoCompareceuMes.length,
      apiTotalReprovados: reprovadosEmpresaRes.reportedTotal,
      apiTotalContratados: contratadosRes.reportedTotal,
      apiTotalNaoCompareceu: naoCompareceuRes.reportedTotal,
      freezeEntryCount: freezeEntries.length,
      freezeLastSyncAt: freezePayload?.lastSyncAt || null,
    },
  };
}
