import { getEstagius, isMinivagasConfigured } from '@/lib/minivagas-api';
import type { Company } from '@/types';

/** Status finais do ranking. */
export type CandidatoStatusFinal = 'reprovado' | 'contratado';

/** Status extras só para estimar “enviados” (funil ainda aberto). */
const PIPELINE_STATUSES = [
  'aprovado',
  'pendente',
  'em_analise',
  'em-analise',
  'entrevista',
  'enviado',
  'em_processo',
  'em-processo',
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
  full_name?: string;
  status?: string;
  cnpj?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  job_posting?: {
    id?: number;
    company_name?: string | null;
    cnpj?: string | null;
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
  decididos: number;
  hireRate: number | null;
  rejectRate: number | null;
  /** 0–100 com base na taxa de contratação entre decididos */
  score: number | null;
  label: ReputationLabel;
};

export type CompanyMinivagasExtras = {
  observacoes: string | null;
  reprovados: number;
  contratados: number;
  reprovadosMes: number;
  contratadosMes: number;
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
  emFunil: number;
  name: string;
};

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
  const total = asNumber(metaObj.total);

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

/** Tenta status de funil; se a rota não existir, ignora. */
async function fetchPipelineOptional(): Promise<MinivagasCandidato[]> {
  const results = await Promise.allSettled(
    PIPELINE_STATUSES.map((status) => fetchCandidatosByStatus(status))
  );

  const byId = new Map<number, MinivagasCandidato>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value.items) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
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
  return { reprovados: 0, contratados: 0, emFunil: 0, name };
}

function accumulateCandidates(
  list: MinivagasCandidato[],
  field: 'reprovados' | 'contratados' | 'emFunil',
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
  pipeline: MinivagasCandidato[] = []
): Map<string, Counts> {
  const byCnpj = new Map<string, Counts>();
  accumulateCandidates(reprovados, 'reprovados', byCnpj);
  accumulateCandidates(contratados, 'contratados', byCnpj);
  accumulateCandidates(pipeline, 'emFunil', byCnpj);
  return byCnpj;
}

export function computeReputation(counts: Counts): CompanyReputation {
  const contratados = counts.contratados;
  const reprovados = counts.reprovados;
  const emFunil = counts.emFunil;
  const decididos = contratados + reprovados;
  const enviados = decididos + emFunil;

  if (decididos === 0 && enviados === 0) {
    return {
      enviados: 0,
      emFunil: 0,
      contratados: 0,
      reprovados: 0,
      decididos: 0,
      hireRate: null,
      rejectRate: null,
      score: null,
      label: 'Sem dados',
    };
  }

  const hireRate = decididos > 0 ? contratados / decididos : null;
  const rejectRate = decididos > 0 ? reprovados / decididos : null;
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
    decididos,
    hireRate,
    rejectRate,
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
  hiringByCnpjMonth: Map<string, Counts>
): CompanyMinivagasExtras | null {
  const digits = normalizeCnpj(company.cnpj);
  if (!digits) return null;

  const observacoes = observacoesByCnpj.get(digits) || null;
  const hiring = hiringByCnpj.get(digits);
  const hiringMonth = hiringByCnpjMonth.get(digits);

  if (!observacoes && !hiring && !hiringMonth) return null;

  const reputation = hiring ? computeReputation(hiring) : null;

  return {
    observacoes,
    reprovados: hiring?.reprovados ?? 0,
    contratados: hiring?.contratados ?? 0,
    reprovadosMes: hiringMonth?.reprovados ?? 0,
    contratadosMes: hiringMonth?.contratados ?? 0,
    enviados: reputation?.enviados ?? 0,
    emFunil: reputation?.emFunil ?? 0,
    reputation,
    minivagasName: hiring?.name || hiringMonth?.name,
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

/** Ranking por taxa de contratação (mín. 5 decisões). */
export function buildReputationRanking(
  companies: Company[],
  hiringByCnpj: Map<string, Counts>,
  options?: { minDecided?: number; limit?: number }
): ReputationRankRow[] {
  const minDecided = options?.minDecided ?? 5;
  const limit = options?.limit ?? 20;

  const companyByCnpj = new Map<string, Company>();
  for (const company of companies) {
    const digits = normalizeCnpj(company.cnpj);
    if (digits) companyByCnpj.set(digits, company);
  }

  const rows: ReputationRankRow[] = [];
  for (const [cnpjDigits, counts] of hiringByCnpj.entries()) {
    const reputation = computeReputation(counts);
    if ((reputation.decididos || 0) < minDecided) continue;
    if (reputation.hireRate == null) continue;
    const matched = companyByCnpj.get(cnpjDigits);
    rows.push({
      cnpjDigits,
      companyId: matched?.id ?? null,
      companyName: matched ? matched.tradeName || matched.name : counts.name,
      onMap: Boolean(matched),
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
  emFunil: number;
  enviados: number;
  reprovadosMes: number;
  contratadosMes: number;
  apiTotalReprovados: number | null;
  apiTotalContratados: number | null;
};

export type MinivagasBundle = {
  observacoesByCnpj: Map<string, string>;
  hiringByCnpj: Map<string, Counts>;
  hiringByCnpjMonth: Map<string, Counts>;
  topRejecters: HiringRankRow[];
  topHired: HiringRankRow[];
  topRejectersMonth: HiringRankRow[];
  topHiredMonth: HiringRankRow[];
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
  topReputation: ReputationRankRow[];
} {
  if (period === 'month') {
    return {
      topRejecters: bundle.topRejectersMonth,
      topHired: bundle.topHiredMonth,
      topReputation: bundle.topReputationMonth,
    };
  }
  return {
    topRejecters: bundle.topRejecters,
    topHired: bundle.topHired,
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

  const [users, reprovadosRes, contratadosRes, pipeline] = await Promise.all([
    fetchMinivagasUsers(),
    fetchCandidatosByStatus('reprovado'),
    fetchCandidatosByStatus('contratado'),
    fetchPipelineOptional(),
  ]);

  const reprovados = reprovadosRes.items;
  const contratados = contratadosRes.items;

  const reprovadosMes = filterCandidatosByPeriod(reprovados, 'month');
  const contratadosMes = filterCandidatosByPeriod(contratados, 'month');
  const pipelineMes = filterCandidatosByPeriod(pipeline, 'month');

  const observacoesByCnpj = buildObservacoesByCnpj(users);
  const hiringByCnpj = buildHiringStatsByCnpj(reprovados, contratados, pipeline);
  const hiringByCnpjMonth = buildHiringStatsByCnpj(
    reprovadosMes,
    contratadosMes,
    pipelineMes
  );

  const companyCnpjs = new Set(
    companies.map((c) => normalizeCnpj(c.cnpj)).filter((d) => d.length >= 11)
  );

  let matchedObservacoes = 0;
  let matchedHiring = 0;
  let enviados = 0;
  let emFunil = 0;
  for (const digits of companyCnpjs) {
    if (observacoesByCnpj.has(digits)) matchedObservacoes += 1;
    if (hiringByCnpj.has(digits) || hiringByCnpjMonth.has(digits)) matchedHiring += 1;
  }
  for (const counts of hiringByCnpj.values()) {
    emFunil += counts.emFunil;
    enviados += counts.contratados + counts.reprovados + counts.emFunil;
  }

  return {
    observacoesByCnpj,
    hiringByCnpj,
    hiringByCnpjMonth,
    topRejecters: buildSingleSideRanking(companies, reprovados),
    topHired: buildSingleSideRanking(companies, contratados),
    topRejectersMonth: buildSingleSideRanking(companies, reprovadosMes),
    topHiredMonth: buildSingleSideRanking(companies, contratadosMes),
    topReputation: buildReputationRanking(companies, hiringByCnpj),
    topReputationMonth: buildReputationRanking(companies, hiringByCnpjMonth, {
      minDecided: 3,
    }),
    matchedObservacoes,
    matchedHiring,
    totals: {
      reprovados: reprovados.length,
      contratados: contratados.length,
      emFunil,
      enviados,
      reprovadosMes: reprovadosMes.length,
      contratadosMes: contratadosMes.length,
      apiTotalReprovados: reprovadosRes.reportedTotal,
      apiTotalContratados: contratadosRes.reportedTotal,
    },
  };
}
