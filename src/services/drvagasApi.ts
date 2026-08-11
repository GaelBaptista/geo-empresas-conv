import { getEstagius, isDrvagasConfigured } from '@/lib/drvagas-api';
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

export type DrvagasUser = {
  id: number;
  name: string;
  email?: string | null;
  cnpj?: string | null;
  cnpjs?: string[] | null;
  role?: string | null;
  observacoes?: string | null;
};

/** Processo seletivo (vaga) — fonte do recrutador. */
export type DrvagasProcessoSeletivo = {
  id: number;
  recrutador?: string | null;
  rh_recruiter?: string | null;
  company_name?: string | null;
  cnpj?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type DrvagasCandidato = {
  id: number;
  job_posting_id?: number;
  full_name?: string;
  status?: string;
  cnpj?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Pode vir null na API — período do ranking usa updated_at/created_at. */
  data_contratacao?: string | null;
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
  /** Taxa de contratação (legado / igual ao aproveitamento atual): contratados / enviados */
  hireRate: number | null;
  rejectRate: number | null;
  noShowRate: number | null;
  /** (reprovados + faltas) / enviados — quanto da base enviada a empresa não aproveitou */
  discardRate: number | null;
  /**
   * Taxa de aproveitamento: contratados / enviados.
   * Quanto a empresa realmente aproveitou do que foi enviado.
   * Em entrevista não conta. Reputação e ordem do ranking usam esta taxa.
   */
  utilizationRate: number | null;
  /** 0–100 = taxa de aproveitamento × 100 */
  score: number | null;
  label: ReputationLabel;
};

export type CompanyDrvagasExtras = {
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
  drvagasName?: string;
  /** Recrutadores dos processos seletivos deste CNPJ. */
  recruiters?: string[];
};

/** Unidade (CNPJ) dentro de um grupo DrVagas. */
export type GroupMemberRef = {
  cnpjDigits: string;
  companyId: string | null;
  companyName: string;
  onMap: boolean;
  /** Recrutadores dos processos seletivos deste CNPJ. */
  recruiters: string[];
  /** Métricas só deste CNPJ (não do grupo). */
  contratados: number;
  reprovados: number;
  naoCompareceu: number;
  emFunil: number;
  hireRate: number | null;
  discardRate: number | null;
  /** Taxa de aproveitamento (0–1) só deste CNPJ. */
  utilizationRate: number | null;
  /** Contagem do ranking de volume atual (contratado/reprovado/falta). */
  volumeCount: number;
};

export type HiringRankRow = {
  /** `mv-{userId}` | `estagius-{id}` | `solo-{cnpj}` */
  groupKey: string;
  /** ID do user DrVagas (role company), quando houver. */
  groupId: number | null;
  memberCount: number;
  members: GroupMemberRef[];
  cnpjDigits: string;
  companyId: string | null;
  companyName: string;
  count: number;
  onMap: boolean;
  /** Recrutadores únicos do grupo (união dos CNPJs). */
  recruiters: string[];
};

export type ReputationRankRow = {
  /** `mv-{userId}` | `estagius-{id}` | `solo-{cnpj}` */
  groupKey: string;
  groupId: number | null;
  memberCount: number;
  members: GroupMemberRef[];
  cnpjDigits: string;
  companyId: string | null;
  companyName: string;
  onMap: boolean;
  reputation: CompanyReputation;
  /** Recrutadores únicos do grupo (união dos CNPJs). */
  recruiters: string[];
};

type DrvagasGroupMeta = {
  userId: number;
  name: string;
  cnpjs: string[];
};

export type DrvagasGroupIndex = {
  cnpjToGroup: Map<string, string>;
  groups: Map<string, DrvagasGroupMeta>;
};

export type HiringPeriod = 'all' | 'month';

/** Mês 1–12. Histórico do ranking começa em ago/2026. */
export type YearMonth = { year: number; month: number };

export type HiringPeriodSelection =
  | { type: 'all' }
  | { type: 'month'; year: number; month: number };

/** Primeiro mês com histórico no ranking (ago/2026). */
export const RANKING_HISTORY_START: YearMonth = { year: 2026, month: 8 };

export function periodKey(selection: HiringPeriodSelection): string {
  if (selection.type === 'all') return 'all';
  return `${selection.year}-${String(selection.month).padStart(2, '0')}`;
}

export function formatYearMonthLabel(ym: YearMonth): string {
  const date = new Date(ym.year, ym.month - 1, 1);
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Geral + meses de ago/2026 até o mês atual (mais recente primeiro). */
export function listRankingPeriodOptions(now = new Date()): Array<{
  key: string;
  selection: HiringPeriodSelection;
  label: string;
}> {
  const options: Array<{
    key: string;
    selection: HiringPeriodSelection;
    label: string;
  }> = [{ key: 'all', selection: { type: 'all' }, label: 'Geral' }];

  const cursor = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
  const start = RANKING_HISTORY_START;

  while (
    cursor.year > start.year ||
    (cursor.year === start.year && cursor.month >= start.month)
  ) {
    const selection: HiringPeriodSelection = {
      type: 'month',
      year: cursor.year,
      month: cursor.month,
    };
    options.push({
      key: periodKey(selection),
      selection,
      label: formatYearMonthLabel(cursor),
    });
    cursor.month -= 1;
    if (cursor.month < 1) {
      cursor.month = 12;
      cursor.year -= 1;
    }
  }

  return options;
}

function isDateInYearMonth(raw: string | null | undefined, ym: YearMonth): boolean {
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === ym.year && date.getMonth() + 1 === ym.month;
}

/** Ano/mês do evento ≥ ym (ex.: Geral acumulado desde ago/2026). */
function isDateOnOrAfterYearMonth(
  raw: string | null | undefined,
  ym: YearMonth
): boolean {
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return year > ym.year || (year === ym.year && month >= ym.month);
}

/** Data usada no filtro de período (data_contratacao null não derruba o registro). */
function candidatoActivityDate(item: DrvagasCandidato): string {
  return item.updated_at || item.created_at || '';
}

function freezeActivityDate(entry: FreezeEntry): string {
  return (
    entry.outcomeAt ||
    entry.lastSeenAt ||
    entry.firstSeenAt ||
    entry.updatedAtApi ||
    ''
  );
}

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
  // Algumas rotas DrVagas devolvem tudo numa página com `count`
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

function allUserCnpjs(user: DrvagasUser): string[] {
  const set = new Set<string>();
  const main = normalizeCnpj(user.cnpj);
  if (main.length >= 11) set.add(main);
  for (const raw of user.cnpjs || []) {
    const digits = normalizeCnpj(raw);
    if (digits.length >= 11) set.add(digits);
  }
  return Array.from(set);
}

function candidatoCnpj(item: DrvagasCandidato): string {
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
  list: DrvagasCandidato[],
  status: string
): DrvagasCandidato[] {
  const expected = normalizeStatus(status);
  return list.filter((item) => {
    const s = normalizeStatus(item.status);
    if (!s) return true;
    return s === expected || s.includes(expected);
  });
}

function isInCurrentMonth(item: DrvagasCandidato, now = new Date()): boolean {
  return isDateInYearMonth(candidatoActivityDate(item), {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
}

function isInYearMonth(item: DrvagasCandidato, ym: YearMonth): boolean {
  return isDateInYearMonth(candidatoActivityDate(item), ym);
}

function isOnOrAfterYearMonth(item: DrvagasCandidato, ym: YearMonth): boolean {
  return isDateOnOrAfterYearMonth(candidatoActivityDate(item), ym);
}

export function filterCandidatosByPeriod(
  list: DrvagasCandidato[],
  period: HiringPeriod
): DrvagasCandidato[] {
  if (period === 'all') {
    return filterCandidatosSinceYearMonth(list, RANKING_HISTORY_START);
  }
  return list.filter((item) => isInCurrentMonth(item));
}

export function filterCandidatosByYearMonth(
  list: DrvagasCandidato[],
  ym: YearMonth
): DrvagasCandidato[] {
  return list.filter((item) => isInYearMonth(item, ym));
}

/** Acumulado desde o mês (inclusive) — usado no Geral. */
export function filterCandidatosSinceYearMonth(
  list: DrvagasCandidato[],
  ym: YearMonth
): DrvagasCandidato[] {
  return list.filter((item) => isOnOrAfterYearMonth(item, ym));
}

export async function fetchDrvagasUsers(): Promise<DrvagasUser[]> {
  const { items } = await fetchAllPages<DrvagasUser>('/users');
  return items;
}

export async function fetchProcessosSeletivos(): Promise<DrvagasProcessoSeletivo[]> {
  try {
    const { items } = await fetchAllPages<DrvagasProcessoSeletivo>('/processos_seletivos');
    return items;
  } catch (err) {
    console.warn('[drvagas] falha ao carregar processos_seletivos (recrutadores)', err);
    return [];
  }
}

/** Nome limpo do recrutador (ignora vazio / "null"). */
function normalizeRecruiterName(value: string | null | undefined): string {
  const name = (value || '').trim().replace(/\s+/g, ' ');
  if (!name) return '';
  if (/^(null|undefined|-|n\/a)$/i.test(name)) return '';
  return name;
}

/**
 * CNPJ → lista de recrutadores únicos (processos seletivos).
 * Mais recentes primeiro; nomes ordenados alfabeticamente na lista final.
 */
export function buildRecruitersByCnpj(
  processos: DrvagasProcessoSeletivo[]
): Map<string, string[]> {
  const ranked = [...processos].sort((a, b) => {
    const ta = Date.parse(b.updated_at || b.created_at || '') || 0;
    const tb = Date.parse(a.updated_at || a.created_at || '') || 0;
    return ta - tb;
  });

  const byCnpj = new Map<string, string[]>();
  for (const processo of ranked) {
    const cnpj = normalizeCnpj(processo.cnpj);
    if (cnpj.length < 11) continue;
    const name =
      normalizeRecruiterName(processo.recrutador) ||
      normalizeRecruiterName(processo.rh_recruiter);
    if (!name) continue;
    const list = byCnpj.get(cnpj) || [];
    if (!list.some((n) => n.toLowerCase() === name.toLowerCase())) {
      list.push(name);
      byCnpj.set(cnpj, list);
    }
  }

  for (const [cnpj, list] of byCnpj) {
    byCnpj.set(
      cnpj,
      [...list].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    );
  }
  return byCnpj;
}

export function unionRecruiterNames(...lists: Array<string[] | undefined>): string[] {
  const set = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list || []) {
      const name = normalizeRecruiterName(raw);
      if (!name) continue;
      const key = name.toLowerCase();
      if (!set.has(key)) set.set(key, name);
    }
  }
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function formatRecruitersLabel(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} · ${names[1]}`;
  return `${names[0]} +${names.length - 1}`;
}

export async function fetchCandidatosByStatus(
  status: string
): Promise<{ items: DrvagasCandidato[]; reportedTotal: number | null }> {
  const { items, reportedTotal } = await fetchAllPages<DrvagasCandidato>(
    `/candidatos/status/${status}`
  );
  return {
    items: filterCandidatosByStatus(items, status),
    reportedTotal,
  };
}

/** Tenta status de entrevista; se a rota não existir, ignora. */
async function fetchEntrevistaStatuses(): Promise<DrvagasCandidato[]> {
  const results = await Promise.allSettled(
    ENTREVISTA_STATUSES.map((status) => fetchCandidatosByStatus(status))
  );

  const byKey = new Map<string, DrvagasCandidato>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value.items) {
      const jobId = item.job_posting_id ?? item.job_posting?.id ?? 0;
      byKey.set(`${item.id}:${jobId}`, item);
    }
  }
  return Array.from(byKey.values());
}

export function buildObservacoesByCnpj(users: DrvagasUser[]): Map<string, string> {
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
  list: DrvagasCandidato[],
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
  reprovados: DrvagasCandidato[],
  contratados: DrvagasCandidato[],
  naoCompareceu: DrvagasCandidato[] = [],
  pipeline: DrvagasCandidato[] = []
): Map<string, Counts> {
  const byCnpj = new Map<string, Counts>();
  accumulateCandidates(reprovados, 'reprovados', byCnpj);
  accumulateCandidates(contratados, 'contratados', byCnpj);
  accumulateCandidates(naoCompareceu, 'naoCompareceu', byCnpj);
  accumulateCandidates(pipeline, 'emFunil', byCnpj);
  return byCnpj;
}

/** Mínimo de candidatos enviados para calcular e rankear reputação. */
export const MIN_ENVIADOS_FOR_REPUTATION = 5;

/** Selo a partir da taxa de aproveitamento (0–1). */
export function labelFromUtilizationRate(
  rate: number,
  opts?: { decididos?: number; emFunil?: number }
): ReputationLabel {
  // Sem decisão ainda: não inflar com “tudo em entrevista”
  if ((opts?.decididos ?? 0) === 0 && (opts?.emFunil ?? 0) > 0) {
    return 'Regular';
  }
  if (rate >= 0.4) return 'Excelente';
  if (rate >= 0.25) return 'Boa';
  if (rate >= 0.15) return 'Regular';
  if (rate >= 0.08) return 'Atenção';
  return 'Crítica';
}

export function computeReputation(counts: Counts): CompanyReputation {
  const contratados = counts.contratados;
  const reprovados = counts.reprovados;
  const naoCompareceu = counts.naoCompareceu;
  const emFunil = counts.emFunil;
  const decididos = contratados + reprovados + naoCompareceu;
  const enviados = decididos + emFunil;

  const emptyRates = {
    hireRate: null as number | null,
    rejectRate: null as number | null,
    noShowRate: null as number | null,
    discardRate: null as number | null,
    utilizationRate: null as number | null,
    score: null as number | null,
    label: 'Sem dados' as ReputationLabel,
  };

  if (enviados <= 0) {
    return {
      enviados: 0,
      emFunil: 0,
      contratados: 0,
      reprovados: 0,
      naoCompareceu: 0,
      decididos: 0,
      ...emptyRates,
    };
  }

  // Amostra pequena: conta volume, mas sem taxa/nota (não entra no ranking).
  if (enviados < MIN_ENVIADOS_FOR_REPUTATION) {
    return {
      enviados,
      emFunil,
      contratados,
      reprovados,
      naoCompareceu,
      decididos,
      ...emptyRates,
    };
  }

  // Taxas sobre candidatos enviados (decididos + em entrevista).
  const hireRate = contratados / enviados;
  const rejectRate = reprovados / enviados;
  const noShowRate = naoCompareceu / enviados;
  const discardRate = (reprovados + naoCompareceu) / enviados;
  // Aproveitamento = quanto a empresa contratou do que enviamos (entrevista não conta).
  const utilizationRate = contratados / enviados;

  const score = Math.round(utilizationRate * 100);
  const label = labelFromUtilizationRate(utilizationRate, {
    decididos,
    emFunil,
  });

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
    discardRate,
    utilizationRate,
    score,
    label,
  };
}

export function countByCnpj(
  list: DrvagasCandidato[]
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
  reputationByCnpjMonth?: Map<string, Counts> | null,
  recruitersByCnpj?: Map<string, string[]> | null
): CompanyDrvagasExtras | null {
  const digits = normalizeCnpj(company.cnpj);
  if (!digits) return null;

  const observacoes = observacoesByCnpj.get(digits) || null;
  const hiring = hiringByCnpj.get(digits);
  const hiringMonth = hiringByCnpjMonth.get(digits);
  const reputationCounts =
    reputationByCnpj?.get(digits) || hiring || null;
  const reputationCountsMonth =
    reputationByCnpjMonth?.get(digits) || hiringMonth || null;
  const recruiters = recruitersByCnpj?.get(digits) || [];

  if (!observacoes && !hiring && !hiringMonth && !reputationCounts && recruiters.length === 0) {
    return null;
  }

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
    drvagasName:
      reputationCounts?.name || hiring?.name || hiringMonth?.name || reputationCountsMonth?.name,
    recruiters,
  };
}

/** Índice CNPJ → grupo DrVagas (`users[].cnpjs`). Grupos maiores ganham em conflito. */
export function buildDrvagasGroupIndex(users: DrvagasUser[]): DrvagasGroupIndex {
  const cnpjToGroup = new Map<string, string>();
  const groups = new Map<string, DrvagasGroupMeta>();

  const ranked = users
    .map((user) => ({ user, cnpjs: allUserCnpjs(user) }))
    .filter(({ user, cnpjs }) => {
      if (cnpjs.length === 0) return false;
      const role = (user.role || '').toLowerCase();
      return role === 'company' || role === '';
    })
    .sort((a, b) => b.cnpjs.length - a.cnpjs.length || b.user.id - a.user.id);

  for (const { user, cnpjs } of ranked) {
    const key = `mv-${user.id}`;
    const name = (user.name || '').trim() || `Grupo ${user.id}`;
    groups.set(key, { userId: user.id, name, cnpjs });
    for (const cnpj of cnpjs) {
      if (!cnpjToGroup.has(cnpj)) cnpjToGroup.set(cnpj, key);
    }
  }

  return { cnpjToGroup, groups };
}

function companyByCnpjMap(companies: Company[]): Map<string, Company> {
  const map = new Map<string, Company>();
  for (const company of companies) {
    const digits = normalizeCnpj(company.cnpj);
    if (digits) map.set(digits, company);
  }
  return map;
}

function resolveGroupKey(
  cnpjDigits: string,
  index: DrvagasGroupIndex,
  company?: Company
): string {
  const fromMv = index.cnpjToGroup.get(cnpjDigits);
  if (fromMv) return fromMv;
  if (company?.groupId != null) return `estagius-${company.groupId}`;
  return `solo-${cnpjDigits}`;
}

function resolveGroupName(
  groupKey: string,
  index: DrvagasGroupIndex,
  company: Company | undefined,
  fallbackName: string
): string {
  const meta = index.groups.get(groupKey);
  if (meta?.name) return meta.name;
  if (groupKey.startsWith('estagius-')) {
    return company?.groupName?.trim() || `Grupo ${groupKey.replace('estagius-', '')}`;
  }
  if (company) return company.tradeName || company.name;
  return fallbackName;
}

function membersForGroupKey(
  groupKey: string,
  index: DrvagasGroupIndex,
  companyByCnpj: Map<string, Company>,
  extraCnpjs: string[] = [],
  statsByCnpj?: Map<string, Counts>,
  volumeByCnpj?: Map<string, number>,
  recruitersByCnpj?: Map<string, string[]>
): GroupMemberRef[] {
  const meta = index.groups.get(groupKey);
  let cnpjs: string[] = [];

  if (meta) {
    cnpjs = [...meta.cnpjs];
  } else if (groupKey.startsWith('solo-')) {
    cnpjs = [groupKey.slice('solo-'.length)];
  } else if (groupKey.startsWith('estagius-')) {
    const estagiusId = Number(groupKey.replace('estagius-', ''));
    cnpjs = Array.from(companyByCnpj.entries())
      .filter(([, company]) => company.groupId === estagiusId)
      .map(([digits]) => digits);
  }

  for (const extra of extraCnpjs) {
    if (extra && !cnpjs.includes(extra)) cnpjs.push(extra);
  }

  const members = cnpjs.map((cnpjDigits) => {
    const matched = companyByCnpj.get(cnpjDigits);
    const stats = statsByCnpj?.get(cnpjDigits);
    const reputation = stats ? computeReputation(stats) : null;
    return {
      cnpjDigits,
      companyId: matched?.id ?? null,
      companyName: matched
        ? matched.tradeName || matched.name
        : stats?.name || `CNPJ ${cnpjDigits}`,
      onMap: Boolean(matched),
      recruiters: recruitersByCnpj?.get(cnpjDigits) || [],
      contratados: stats?.contratados ?? 0,
      reprovados: stats?.reprovados ?? 0,
      naoCompareceu: stats?.naoCompareceu ?? 0,
      emFunil: stats?.emFunil ?? 0,
      hireRate: reputation?.hireRate ?? null,
      discardRate: reputation?.discardRate ?? null,
      utilizationRate: reputation?.utilizationRate ?? null,
      volumeCount: volumeByCnpj?.get(cnpjDigits) ?? 0,
    };
  });

  // Unidades com movimento primeiro
  return members.sort(
    (a, b) =>
      b.contratados +
        b.reprovados +
        b.naoCompareceu +
        b.volumeCount -
        (a.contratados + a.reprovados + a.naoCompareceu + a.volumeCount) ||
      a.companyName.localeCompare(b.companyName, 'pt-BR')
  );
}

function pickRepresentative(members: GroupMemberRef[]): GroupMemberRef | null {
  const onMap = members.filter((m) => m.onMap && m.companyId);
  if (onMap.length > 0) return onMap[0];
  return members[0] || null;
}

function parseDrvagasGroupId(groupKey: string): number | null {
  if (!groupKey.startsWith('mv-')) return null;
  const id = Number(groupKey.slice(3));
  return Number.isFinite(id) ? id : null;
}

/**
 * Ranking de volume (contratados / reprovados / faltas) agregado por grupo DrVagas.
 * Sem limite por padrão — lista todos os grupos com movimento.
 */
export function buildSingleSideRanking(
  companies: Company[],
  list: DrvagasCandidato[],
  index: DrvagasGroupIndex,
  limit: number | null = null,
  statsByCnpj?: Map<string, Counts>,
  recruitersByCnpj?: Map<string, string[]>
): HiringRankRow[] {
  const companyByCnpj = companyByCnpjMap(companies);
  const byGroup = new Map<string, { count: number; name: string; cnpjs: Set<string> }>();
  const volumeByCnpj = new Map<string, number>();

  for (const item of list) {
    const cnpj = candidatoCnpj(item);
    if (cnpj.length < 11) continue;
    const company = companyByCnpj.get(cnpj);
    const key = resolveGroupKey(cnpj, index, company);
    const fallback = (item.job_posting?.company_name || '').trim() || `CNPJ ${cnpj}`;
    const name = resolveGroupName(key, index, company, fallback);
    const current = byGroup.get(key) || { count: 0, name, cnpjs: new Set<string>() };
    current.count += 1;
    current.cnpjs.add(cnpj);
    if (!current.name || current.name.startsWith('CNPJ ')) current.name = name;
    byGroup.set(key, current);
    volumeByCnpj.set(cnpj, (volumeByCnpj.get(cnpj) || 0) + 1);
  }

  const rows: HiringRankRow[] = [];
  for (const [groupKey, data] of byGroup.entries()) {
    if (data.count <= 0) continue;
    const members = membersForGroupKey(
      groupKey,
      index,
      companyByCnpj,
      [...data.cnpjs],
      statsByCnpj,
      volumeByCnpj,
      recruitersByCnpj
    );
    const rep = pickRepresentative(members);
    const recruiters = unionRecruiterNames(...members.map((m) => m.recruiters));
    rows.push({
      groupKey,
      groupId: parseDrvagasGroupId(groupKey),
      memberCount: Math.max(1, members.length),
      members,
      cnpjDigits: rep?.cnpjDigits || [...data.cnpjs][0] || groupKey,
      companyId: rep?.companyId ?? null,
      companyName: data.name,
      count: data.count,
      onMap: Boolean(rep?.onMap),
      recruiters,
    });
  }

  const sorted = rows.sort(
    (a, b) => b.count - a.count || a.companyName.localeCompare(b.companyName, 'pt-BR')
  );
  return limit != null ? sorted.slice(0, limit) : sorted;
}

/**
 * Contagens de reputação por GRUPO DrVagas (soma dos CNPJs do user).
 */
export function buildReputationStatsByGroup(
  companies: Company[],
  index: DrvagasGroupIndex,
  reprovadosEmpresa: DrvagasCandidato[],
  contratados: DrvagasCandidato[],
  naoCompareceu: DrvagasCandidato[],
  emEntrevista: DrvagasCandidato[]
): Map<string, Counts> {
  const companyByCnpj = companyByCnpjMap(companies);
  const byGroup = new Map<string, Counts>();

  const add = (list: DrvagasCandidato[], field: CountField) => {
    for (const item of list) {
      const cnpj = candidatoCnpj(item);
      if (cnpj.length < 11) continue;
      const company = companyByCnpj.get(cnpj);
      const key = resolveGroupKey(cnpj, index, company);
      const fallback = (item.job_posting?.company_name || '').trim() || `CNPJ ${cnpj}`;
      const name = resolveGroupName(key, index, company, fallback);
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
): DrvagasCandidato[] {
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

/** Chave estável candidato+vaga — evita contar duas vezes no merge freeze × API. */
function candidatoJobKey(item: DrvagasCandidato): string {
  const jobId = item.job_posting_id ?? item.job_posting?.id ?? 0;
  return `${item.id}:${jobId}`;
}

/**
 * Une listas de desfecho: API ao vivo tem prioridade; freeze preenche buracos
 * (ex.: contratado antigo que sumiu da paginação do sync).
 */
function mergeCandidatosByJob(
  primary: DrvagasCandidato[],
  secondary: DrvagasCandidato[]
): DrvagasCandidato[] {
  const map = new Map<string, DrvagasCandidato>();
  for (const item of secondary) {
    map.set(candidatoJobKey(item), item);
  }
  for (const item of primary) {
    map.set(candidatoJobKey(item), item);
  }
  return [...map.values()];
}

/** Tira do funil quem já tem desfecho na API (não contar como enviado duas vezes). */
function excludeDecidedFromFunnel(
  emFunil: DrvagasCandidato[],
  decided: DrvagasCandidato[]
): DrvagasCandidato[] {
  if (emFunil.length === 0 || decided.length === 0) return emFunil;
  const decidedKeys = new Set(decided.map(candidatoJobKey));
  return emFunil.filter((item) => !decidedKeys.has(candidatoJobKey(item)));
}

function isFreezeEntryInMonth(entry: FreezeEntry, now = new Date()): boolean {
  return isFreezeEntryInYearMonth(entry, {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
}

function isFreezeEntryInYearMonth(entry: FreezeEntry, ym: YearMonth): boolean {
  return isDateInYearMonth(freezeActivityDate(entry), ym);
}

function isFreezeEntryOnOrAfterYearMonth(entry: FreezeEntry, ym: YearMonth): boolean {
  return isDateOnOrAfterYearMonth(freezeActivityDate(entry), ym);
}

/** Espelha a contagem do grupo em cada CNPJ membro (para ficha da empresa). */
export function expandGroupStatsToCnpjs(
  companies: Company[],
  index: DrvagasGroupIndex,
  hiringByGroup: Map<string, Counts>
): Map<string, Counts> {
  const byCnpj = new Map<string, Counts>();
  const companyByCnpj = companyByCnpjMap(companies);

  for (const [groupKey, counts] of hiringByGroup.entries()) {
    const members = membersForGroupKey(groupKey, index, companyByCnpj);
    if (members.length === 0 && groupKey.startsWith('solo-')) {
      byCnpj.set(groupKey.slice('solo-'.length), counts);
      continue;
    }
    for (const member of members) {
      byCnpj.set(member.cnpjDigits, counts);
    }
  }

  // Garante CNPJs do mapa que caem no mesmo grupo mesmo sem atividade própria
  for (const company of companies) {
    const digits = normalizeCnpj(company.cnpj);
    if (!digits || byCnpj.has(digits)) continue;
    const key = resolveGroupKey(digits, index, company);
    const counts = hiringByGroup.get(key);
    if (counts) byCnpj.set(digits, counts);
  }

  return byCnpj;
}

/** Ranking de reputação por GRUPO DrVagas (taxa após entrevista). */
export function buildReputationRanking(
  companies: Company[],
  index: DrvagasGroupIndex,
  hiringByGroup: Map<string, Counts>,
  options?: {
    /** Mínimo de resultados (contratou/reprovou/faltou). Padrão 0 = qualquer movimentação. */
    minDecided?: number;
    /**
     * Mínimo de candidatos enviados (decididos + entrevista).
     * Padrão: MIN_ENVIADOS_FOR_REPUTATION (5).
     */
    minEnviados?: number;
    /** null = lista completa. */
    limit?: number | null;
    /** Contagens reais por CNPJ (não espelho do grupo). */
    statsByCnpj?: Map<string, Counts>;
    /** Recrutadores por CNPJ (processos seletivos). */
    recruitersByCnpj?: Map<string, string[]>;
  }
): ReputationRankRow[] {
  const minDecided = options?.minDecided ?? 0;
  const minEnviados = options?.minEnviados ?? MIN_ENVIADOS_FOR_REPUTATION;
  const limit = options?.limit ?? null;
  const companyByCnpj = companyByCnpjMap(companies);
  const statsByCnpj = options?.statsByCnpj;
  const recruitersByCnpj = options?.recruitersByCnpj;

  const rows: ReputationRankRow[] = [];
  for (const [groupKey, counts] of hiringByGroup.entries()) {
    const reputation = computeReputation(counts);
    // Só grupos com amostra mínima (5+ enviados). Inclui quem está só em entrevista.
    if ((reputation.enviados || 0) < minEnviados) continue;
    if (reputation.utilizationRate == null && reputation.hireRate == null) continue;
    if ((reputation.decididos || 0) < minDecided && (reputation.emFunil || 0) === 0) {
      continue;
    }

    const members = membersForGroupKey(
      groupKey,
      index,
      companyByCnpj,
      [],
      statsByCnpj,
      undefined,
      recruitersByCnpj
    );
    const rep = pickRepresentative(members);
    const recruiters = unionRecruiterNames(...members.map((m) => m.recruiters));

    rows.push({
      groupKey,
      groupId: parseDrvagasGroupId(groupKey),
      memberCount: Math.max(1, members.length),
      members,
      cnpjDigits: rep?.cnpjDigits || groupKey,
      companyId: rep?.companyId ?? null,
      companyName: counts.name,
      onMap: Boolean(rep?.onMap),
      reputation,
      recruiters,
    });
  }

  const sorted = rows.sort(
    (a, b) =>
      (b.reputation.utilizationRate ?? -1) - (a.reputation.utilizationRate ?? -1) ||
      (a.reputation.discardRate ?? 1) - (b.reputation.discardRate ?? 1) ||
      b.reputation.decididos - a.reputation.decididos ||
      b.reputation.enviados - a.reputation.enviados ||
      a.companyName.localeCompare(b.companyName, 'pt-BR')
  );
  return limit != null ? sorted.slice(0, limit) : sorted;
}

export function reputationCriteria(label: ReputationLabel): string {
  switch (label) {
    case 'Excelente':
      return 'Aproveitamento ≥ 40% da base enviada';
    case 'Boa':
      return 'Aproveitamento entre 25% e 39% da base enviada';
    case 'Regular':
      return 'Aproveitamento entre 15% e 24% da base enviada';
    case 'Atenção':
      return 'Aproveitamento entre 8% e 14% da base enviada';
    case 'Crítica':
      return 'Aproveitamento abaixo de 8% da base enviada';
    default:
      return 'Menos de 5 candidatos enviados (sem taxa)';
  }
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

/** Dados brutos para remontar rankings de qualquer mês do histórico. */
export type DrvagasRankingSource = {
  useFreeze: boolean;
  freezeEntries: FreezeEntry[];
  volumeReprovados: DrvagasCandidato[];
  volumeContratados: DrvagasCandidato[];
  volumeNaoCompareceu: DrvagasCandidato[];
  volumeEntrevista: DrvagasCandidato[];
  reprovadosEmpresa: DrvagasCandidato[];
  contratados: DrvagasCandidato[];
  naoCompareceu: DrvagasCandidato[];
  emEntrevista: DrvagasCandidato[];
};

export type PeriodRankings = {
  topRejecters: HiringRankRow[];
  topHired: HiringRankRow[];
  topNoShows: HiringRankRow[];
  topReputation: ReputationRankRow[];
  totals: {
    enviados: number;
    contratados: number;
    reprovados: number;
    naoCompareceu: number;
    emFunil: number;
  };
};

export type DrvagasBundle = {
  observacoesByCnpj: Map<string, string>;
  hiringByCnpj: Map<string, Counts>;
  hiringByCnpjMonth: Map<string, Counts>;
  /** Contagens de reputação (pós-entrevista) espelhadas por CNPJ do grupo. */
  reputationByCnpj: Map<string, Counts>;
  reputationByCnpjMonth: Map<string, Counts>;
  /** Recrutadores por CNPJ (processos seletivos). */
  recruitersByCnpj: Map<string, string[]>;
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
  groupIndex: DrvagasGroupIndex;
  source: DrvagasRankingSource;
};

export function rankingsForPeriod(
  bundle: DrvagasBundle,
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

function buildPeriodSlice(
  source: DrvagasRankingSource,
  ym: YearMonth | null
): {
  volumeReprovados: DrvagasCandidato[];
  volumeContratados: DrvagasCandidato[];
  volumeNaoCompareceu: DrvagasCandidato[];
  volumeEntrevista: DrvagasCandidato[];
  reprovados: DrvagasCandidato[];
  contratados: DrvagasCandidato[];
  naoCompareceu: DrvagasCandidato[];
  emFunil: DrvagasCandidato[];
} {
  // null = Geral → acumulado desde RANKING_HISTORY_START (não todo o histórico)
  const filterVolume = (list: DrvagasCandidato[]) =>
    ym
      ? filterCandidatosByYearMonth(list, ym)
      : filterCandidatosSinceYearMonth(list, RANKING_HISTORY_START);
  const filterFreeze = (entries: FreezeEntry[]) =>
    ym
      ? entries.filter((e) => isFreezeEntryInYearMonth(e, ym))
      : entries.filter((e) =>
          isFreezeEntryOnOrAfterYearMonth(e, RANKING_HISTORY_START)
        );

  const volumeReprovados = filterVolume(source.volumeReprovados);
  const volumeContratados = filterVolume(source.volumeContratados);
  const volumeNaoCompareceu = filterVolume(source.volumeNaoCompareceu);
  const volumeEntrevista = filterVolume(source.volumeEntrevista);

  if (!source.useFreeze) {
    return {
      volumeReprovados,
      volumeContratados,
      volumeNaoCompareceu,
      volumeEntrevista,
      reprovados: filterVolume(source.reprovadosEmpresa),
      contratados: filterVolume(source.contratados),
      naoCompareceu: filterVolume(source.naoCompareceu),
      emFunil: filterVolume(source.emEntrevista),
    };
  }

  const freezePeriod = filterFreeze(source.freezeEntries);
  const reprovados = mergeCandidatosByJob(
    volumeReprovados,
    freezeEntriesToCandidatos(freezePeriod, 'reprovado_empresa')
  );
  const contratados = mergeCandidatosByJob(
    volumeContratados,
    freezeEntriesToCandidatos(freezePeriod, 'contratado')
  );
  const naoCompareceu = mergeCandidatosByJob(
    volumeNaoCompareceu,
    freezeEntriesToCandidatos(freezePeriod, 'nao_compareceu_empresa')
  );
  const emFunil = excludeDecidedFromFunnel(
    freezeEntriesToCandidatos(freezePeriod, 'em_funil'),
    [...reprovados, ...contratados, ...naoCompareceu]
  );

  return {
    volumeReprovados,
    volumeContratados,
    volumeNaoCompareceu,
    volumeEntrevista,
    reprovados,
    contratados,
    naoCompareceu,
    emFunil,
  };
}

/** Rankings + totais para Geral (desde ago/2026) ou um mês específico. */
export function rankingsForSelection(
  bundle: DrvagasBundle,
  companies: Company[],
  selection: HiringPeriodSelection
): PeriodRankings {
  const ym =
    selection.type === 'all'
      ? null
      : { year: selection.year, month: selection.month };
  const slice = buildPeriodSlice(bundle.source, ym);
  const hiringByCnpj = buildHiringStatsByCnpj(
    slice.volumeReprovados,
    slice.volumeContratados,
    slice.volumeNaoCompareceu,
    slice.volumeEntrevista
  );
  const reputationByGroup = buildReputationStatsByGroup(
    companies,
    bundle.groupIndex,
    slice.reprovados,
    slice.contratados,
    slice.naoCompareceu,
    slice.emFunil
  );
  const reputationStatsByCnpj = buildHiringStatsByCnpj(
    slice.reprovados,
    slice.contratados,
    slice.naoCompareceu,
    slice.emFunil
  );

  const enviados = bundle.source.useFreeze
    ? new Set(
        [...slice.reprovados, ...slice.contratados, ...slice.naoCompareceu, ...slice.emFunil].map(
          candidatoJobKey
        )
      ).size
    : slice.volumeContratados.length +
      slice.volumeReprovados.length +
      slice.volumeNaoCompareceu.length +
      slice.volumeEntrevista.length;

  return {
    topRejecters: buildSingleSideRanking(
      companies,
      slice.volumeReprovados,
      bundle.groupIndex,
      null,
      hiringByCnpj,
      bundle.recruitersByCnpj
    ),
    topHired: buildSingleSideRanking(
      companies,
      slice.volumeContratados,
      bundle.groupIndex,
      null,
      hiringByCnpj,
      bundle.recruitersByCnpj
    ),
    topNoShows: buildSingleSideRanking(
      companies,
      slice.volumeNaoCompareceu,
      bundle.groupIndex,
      null,
      hiringByCnpj,
      bundle.recruitersByCnpj
    ),
    topReputation: buildReputationRanking(companies, bundle.groupIndex, reputationByGroup, {
      minDecided: 0,
      minEnviados: MIN_ENVIADOS_FOR_REPUTATION,
      statsByCnpj: reputationStatsByCnpj,
      recruitersByCnpj: bundle.recruitersByCnpj,
    }),
    totals: {
      enviados,
      contratados: slice.volumeContratados.length,
      reprovados: slice.volumeReprovados.length,
      naoCompareceu: slice.volumeNaoCompareceu.length,
      emFunil: slice.emFunil.length,
    },
  };
}

export function reputationTone(label: ReputationLabel): string {
  switch (label) {
    case 'Excelente':
      return 'text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-200 dark:bg-emerald-950/55 dark:border-emerald-700/70';
    case 'Boa':
      return 'text-teal-800 bg-teal-50 border-teal-200 dark:text-teal-200 dark:bg-teal-950/55 dark:border-teal-700/70';
    case 'Regular':
      return 'text-amber-900 bg-amber-50 border-amber-200 dark:text-amber-100 dark:bg-amber-950/45 dark:border-amber-700/70';
    case 'Atenção':
      return 'text-orange-900 bg-orange-50 border-orange-200 dark:text-orange-100 dark:bg-orange-950/45 dark:border-orange-700/70';
    case 'Crítica':
      return 'text-rose-800 bg-rose-50 border-rose-200 dark:text-rose-100 dark:bg-rose-950/50 dark:border-rose-700/70';
    default:
      return 'text-muted-foreground bg-muted border-border';
  }
}

export async function loadDrvagasBundle(companies: Company[]): Promise<DrvagasBundle | null> {
  if (!isDrvagasConfigured()) return null;

  // Backup: se alguém abrir o app, tenta sync (debounce 10 min no servidor)
  triggerEntrevistaFreezeSync();

  const [
    users,
    reprovadosEmpresaRes,
    contratadosRes,
    naoCompareceuRes,
    entrevistaLive,
    freezePayload,
    processosSeletivos,
  ] = await Promise.all([
    fetchDrvagasUsers(),
    fetchCandidatosByStatus('reprovado_empresa'),
    fetchCandidatosByStatus('contratado'),
    fetchCandidatosByStatus('nao_compareceu_empresa'),
    fetchEntrevistaStatuses(),
    fetchEntrevistaFreeze(),
    fetchProcessosSeletivos(),
  ]);

  const recruitersByCnpj = buildRecruitersByCnpj(processosSeletivos);

  const freezeEntries = freezePayload?.entries || [];
  const useFreeze = freezeEntries.length > 0;

  // Volume: sempre tags ao vivo (bate com a listagem do DrVagas)
  const volumeReprovados = reprovadosEmpresaRes.items;
  const volumeContratados = contratadosRes.items;
  const volumeNaoCompareceu = naoCompareceuRes.items;
  const volumeEntrevista = entrevistaLive;

  // Reputação — desfechos: API ao vivo ∪ freeze (API manda; freeze completa faltantes)
  // Funil: freeze (histórico de entrevista sem desfecho), sem quem já decidiu na API
  const freezeReprovados = useFreeze
    ? freezeEntriesToCandidatos(freezeEntries, 'reprovado_empresa')
    : [];
  const freezeContratados = useFreeze
    ? freezeEntriesToCandidatos(freezeEntries, 'contratado')
    : [];
  const freezeNaoCompareceu = useFreeze
    ? freezeEntriesToCandidatos(freezeEntries, 'nao_compareceu_empresa')
    : [];
  const freezeEmFunil = useFreeze
    ? freezeEntriesToCandidatos(freezeEntries, 'em_funil')
    : [];

  const reprovadosEmpresa = useFreeze
    ? mergeCandidatosByJob(volumeReprovados, freezeReprovados)
    : volumeReprovados;
  const contratados = useFreeze
    ? mergeCandidatosByJob(volumeContratados, freezeContratados)
    : volumeContratados;
  const naoCompareceu = useFreeze
    ? mergeCandidatosByJob(volumeNaoCompareceu, freezeNaoCompareceu)
    : volumeNaoCompareceu;
  const emEntrevista = useFreeze
    ? excludeDecidedFromFunnel(freezeEmFunil, [
        ...reprovadosEmpresa,
        ...contratados,
        ...naoCompareceu,
      ])
    : volumeEntrevista;

  const freezeMonth = freezeEntries.filter((e) => isFreezeEntryInMonth(e));
  const reprovadosMes = useFreeze
    ? mergeCandidatosByJob(
        filterCandidatosByPeriod(volumeReprovados, 'month'),
        freezeEntriesToCandidatos(freezeMonth, 'reprovado_empresa')
      )
    : filterCandidatosByPeriod(reprovadosEmpresa, 'month');
  const contratadosMes = useFreeze
    ? mergeCandidatosByJob(
        filterCandidatosByPeriod(volumeContratados, 'month'),
        freezeEntriesToCandidatos(freezeMonth, 'contratado')
      )
    : filterCandidatosByPeriod(contratados, 'month');
  const naoCompareceuMes = useFreeze
    ? mergeCandidatosByJob(
        filterCandidatosByPeriod(volumeNaoCompareceu, 'month'),
        freezeEntriesToCandidatos(freezeMonth, 'nao_compareceu_empresa')
      )
    : filterCandidatosByPeriod(naoCompareceu, 'month');
  const entrevistaMes = useFreeze
    ? excludeDecidedFromFunnel(
        freezeEntriesToCandidatos(freezeMonth, 'em_funil'),
        [...reprovadosMes, ...contratadosMes, ...naoCompareceuMes]
      )
    : filterCandidatosByPeriod(emEntrevista, 'month');

  const volumeReprovadosMes = filterCandidatosByPeriod(volumeReprovados, 'month');
  const volumeContratadosMes = filterCandidatosByPeriod(volumeContratados, 'month');
  const volumeNaoCompareceuMes = filterCandidatosByPeriod(volumeNaoCompareceu, 'month');
  const volumeEntrevistaMes = filterCandidatosByPeriod(volumeEntrevista, 'month');

  const observacoesByCnpj = buildObservacoesByCnpj(users);
  const groupIndex = buildDrvagasGroupIndex(users);

  // Geral = acumulado desde ago/2026 (não o histórico completo da API)
  const sourceAll: DrvagasRankingSource = {
    useFreeze,
    freezeEntries,
    volumeReprovados,
    volumeContratados,
    volumeNaoCompareceu,
    volumeEntrevista,
    reprovadosEmpresa,
    contratados,
    naoCompareceu,
    emEntrevista,
  };
  const geral = buildPeriodSlice(sourceAll, null);

  const hiringByCnpj = buildHiringStatsByCnpj(
    geral.volumeReprovados,
    geral.volumeContratados,
    geral.volumeNaoCompareceu,
    geral.volumeEntrevista
  );
  const hiringByCnpjMonth = buildHiringStatsByCnpj(
    volumeReprovadosMes,
    volumeContratadosMes,
    volumeNaoCompareceuMes,
    volumeEntrevistaMes
  );

  const reputationByGroup = buildReputationStatsByGroup(
    companies,
    groupIndex,
    geral.reprovados,
    geral.contratados,
    geral.naoCompareceu,
    geral.emFunil
  );
  const reputationByGroupMonth = buildReputationStatsByGroup(
    companies,
    groupIndex,
    reprovadosMes,
    contratadosMes,
    naoCompareceuMes,
    entrevistaMes
  );
  const reputationByCnpj = expandGroupStatsToCnpjs(companies, groupIndex, reputationByGroup);
  const reputationByCnpjMonth = expandGroupStatsToCnpjs(
    companies,
    groupIndex,
    reputationByGroupMonth
  );

  // Contagens reais por CNPJ (para o menu de unidades — não espelha o grupo)
  const reputationStatsByCnpj = buildHiringStatsByCnpj(
    geral.reprovados,
    geral.contratados,
    geral.naoCompareceu,
    geral.emFunil
  );
  const reputationStatsByCnpjMonth = buildHiringStatsByCnpj(
    reprovadosMes,
    contratadosMes,
    naoCompareceuMes,
    entrevistaMes
  );

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
    recruitersByCnpj,
    topRejecters: buildSingleSideRanking(
      companies,
      geral.volumeReprovados,
      groupIndex,
      null,
      hiringByCnpj,
      recruitersByCnpj
    ),
    topHired: buildSingleSideRanking(
      companies,
      geral.volumeContratados,
      groupIndex,
      null,
      hiringByCnpj,
      recruitersByCnpj
    ),
    topNoShows: buildSingleSideRanking(
      companies,
      geral.volumeNaoCompareceu,
      groupIndex,
      null,
      hiringByCnpj,
      recruitersByCnpj
    ),
    topRejectersMonth: buildSingleSideRanking(
      companies,
      volumeReprovadosMes,
      groupIndex,
      null,
      hiringByCnpjMonth,
      recruitersByCnpj
    ),
    topHiredMonth: buildSingleSideRanking(
      companies,
      volumeContratadosMes,
      groupIndex,
      null,
      hiringByCnpjMonth,
      recruitersByCnpj
    ),
    topNoShowsMonth: buildSingleSideRanking(
      companies,
      volumeNaoCompareceuMes,
      groupIndex,
      null,
      hiringByCnpjMonth,
      recruitersByCnpj
    ),
    topReputation: buildReputationRanking(companies, groupIndex, reputationByGroup, {
      minDecided: 0,
      minEnviados: MIN_ENVIADOS_FOR_REPUTATION,
      statsByCnpj: reputationStatsByCnpj,
      recruitersByCnpj,
    }),
    topReputationMonth: buildReputationRanking(companies, groupIndex, reputationByGroupMonth, {
      minDecided: 0,
      minEnviados: MIN_ENVIADOS_FOR_REPUTATION,
      statsByCnpj: reputationStatsByCnpjMonth,
      recruitersByCnpj,
    }),
    matchedObservacoes,
    matchedHiring,
    totals: {
      reprovados: geral.volumeReprovados.length,
      contratados: geral.volumeContratados.length,
      naoCompareceu: geral.volumeNaoCompareceu.length,
      emFunil: geral.emFunil.length,
      enviados: useFreeze
        ? new Set(
            [
              ...geral.reprovados,
              ...geral.contratados,
              ...geral.naoCompareceu,
              ...geral.emFunil,
            ].map(candidatoJobKey)
          ).size
        : geral.volumeContratados.length +
          geral.volumeReprovados.length +
          geral.volumeNaoCompareceu.length +
          geral.volumeEntrevista.length,
      reprovadosMes: volumeReprovadosMes.length,
      contratadosMes: volumeContratadosMes.length,
      naoCompareceuMes: volumeNaoCompareceuMes.length,
      apiTotalReprovados: reprovadosEmpresaRes.reportedTotal,
      apiTotalContratados: contratadosRes.reportedTotal,
      apiTotalNaoCompareceu: naoCompareceuRes.reportedTotal,
      freezeEntryCount: freezeEntries.length,
      freezeLastSyncAt:
        freezePayload?.lastSyncAt || freezePayload?.updatedAt || new Date().toISOString(),
    },
    groupIndex,
    source: sourceAll,
  };
}
