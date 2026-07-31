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

/** Unidade (CNPJ) dentro de um grupo Minivagas. */
export type GroupMemberRef = {
  cnpjDigits: string;
  companyId: string | null;
  companyName: string;
  onMap: boolean;
  /** Métricas só deste CNPJ (não do grupo). */
  contratados: number;
  reprovados: number;
  naoCompareceu: number;
  emFunil: number;
  hireRate: number | null;
  /** Contagem do ranking de volume atual (contratado/reprovado/falta). */
  volumeCount: number;
};

export type HiringRankRow = {
  /** `mv-{userId}` | `estagius-{id}` | `solo-{cnpj}` */
  groupKey: string;
  /** ID do user Minivagas (role company), quando houver. */
  groupId: number | null;
  memberCount: number;
  members: GroupMemberRef[];
  cnpjDigits: string;
  companyId: string | null;
  companyName: string;
  count: number;
  onMap: boolean;
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
};

type MinivagasGroupMeta = {
  userId: number;
  name: string;
  cnpjs: string[];
};

export type MinivagasGroupIndex = {
  cnpjToGroup: Map<string, string>;
  groups: Map<string, MinivagasGroupMeta>;
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

/** Índice CNPJ → grupo Minivagas (`users[].cnpjs`). Grupos maiores ganham em conflito. */
export function buildMinivagasGroupIndex(users: MinivagasUser[]): MinivagasGroupIndex {
  const cnpjToGroup = new Map<string, string>();
  const groups = new Map<string, MinivagasGroupMeta>();

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
  index: MinivagasGroupIndex,
  company?: Company
): string {
  const fromMv = index.cnpjToGroup.get(cnpjDigits);
  if (fromMv) return fromMv;
  if (company?.groupId != null) return `estagius-${company.groupId}`;
  return `solo-${cnpjDigits}`;
}

function resolveGroupName(
  groupKey: string,
  index: MinivagasGroupIndex,
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
  index: MinivagasGroupIndex,
  companyByCnpj: Map<string, Company>,
  extraCnpjs: string[] = [],
  statsByCnpj?: Map<string, Counts>,
  volumeByCnpj?: Map<string, number>
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
      contratados: stats?.contratados ?? 0,
      reprovados: stats?.reprovados ?? 0,
      naoCompareceu: stats?.naoCompareceu ?? 0,
      emFunil: stats?.emFunil ?? 0,
      hireRate: reputation?.hireRate ?? null,
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

function parseMinivagasGroupId(groupKey: string): number | null {
  if (!groupKey.startsWith('mv-')) return null;
  const id = Number(groupKey.slice(3));
  return Number.isFinite(id) ? id : null;
}

/**
 * Ranking de volume (contratados / reprovados / faltas) agregado por grupo Minivagas.
 * Sem limite por padrão — lista todos os grupos com movimento.
 */
export function buildSingleSideRanking(
  companies: Company[],
  list: MinivagasCandidato[],
  index: MinivagasGroupIndex,
  limit: number | null = null,
  statsByCnpj?: Map<string, Counts>
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
      volumeByCnpj
    );
    const rep = pickRepresentative(members);
    rows.push({
      groupKey,
      groupId: parseMinivagasGroupId(groupKey),
      memberCount: Math.max(1, members.length),
      members,
      cnpjDigits: rep?.cnpjDigits || [...data.cnpjs][0] || groupKey,
      companyId: rep?.companyId ?? null,
      companyName: data.name,
      count: data.count,
      onMap: Boolean(rep?.onMap),
    });
  }

  const sorted = rows.sort(
    (a, b) => b.count - a.count || a.companyName.localeCompare(b.companyName, 'pt-BR')
  );
  return limit != null ? sorted.slice(0, limit) : sorted;
}

/**
 * Contagens de reputação por GRUPO Minivagas (soma dos CNPJs do user).
 */
export function buildReputationStatsByGroup(
  companies: Company[],
  index: MinivagasGroupIndex,
  reprovadosEmpresa: MinivagasCandidato[],
  contratados: MinivagasCandidato[],
  naoCompareceu: MinivagasCandidato[],
  emEntrevista: MinivagasCandidato[]
): Map<string, Counts> {
  const companyByCnpj = companyByCnpjMap(companies);
  const byGroup = new Map<string, Counts>();

  const add = (list: MinivagasCandidato[], field: CountField) => {
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

/** Chave estável candidato+vaga — evita contar duas vezes no merge freeze × API. */
function candidatoJobKey(item: MinivagasCandidato): string {
  const jobId = item.job_posting_id ?? item.job_posting?.id ?? 0;
  return `${item.id}:${jobId}`;
}

/**
 * Une listas de desfecho: API ao vivo tem prioridade; freeze preenche buracos
 * (ex.: contratado antigo que sumiu da paginação do sync).
 */
function mergeCandidatosByJob(
  primary: MinivagasCandidato[],
  secondary: MinivagasCandidato[]
): MinivagasCandidato[] {
  const map = new Map<string, MinivagasCandidato>();
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
  emFunil: MinivagasCandidato[],
  decided: MinivagasCandidato[]
): MinivagasCandidato[] {
  if (emFunil.length === 0 || decided.length === 0) return emFunil;
  const decidedKeys = new Set(decided.map(candidatoJobKey));
  return emFunil.filter((item) => !decidedKeys.has(candidatoJobKey(item)));
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
  index: MinivagasGroupIndex,
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

/** Ranking de reputação por GRUPO Minivagas (taxa após entrevista). */
export function buildReputationRanking(
  companies: Company[],
  index: MinivagasGroupIndex,
  hiringByGroup: Map<string, Counts>,
  options?: {
    /** Mínimo de resultados (contratou/reprovou/faltou). Padrão 1 = todos com dado. */
    minDecided?: number;
    /** null = lista completa. */
    limit?: number | null;
    /** Contagens reais por CNPJ (não espelho do grupo). */
    statsByCnpj?: Map<string, Counts>;
  }
): ReputationRankRow[] {
  const minDecided = options?.minDecided ?? 1;
  const limit = options?.limit ?? null;
  const companyByCnpj = companyByCnpjMap(companies);
  const statsByCnpj = options?.statsByCnpj;

  const rows: ReputationRankRow[] = [];
  for (const [groupKey, counts] of hiringByGroup.entries()) {
    const reputation = computeReputation(counts);
    // Inclui qualquer grupo com movimento (enviados ou resultado)
    if ((reputation.enviados || 0) < 1) continue;
    if ((reputation.decididos || 0) < minDecided && (reputation.emFunil || 0) === 0) {
      continue;
    }

    const members = membersForGroupKey(
      groupKey,
      index,
      companyByCnpj,
      [],
      statsByCnpj
    );
    const rep = pickRepresentative(members);

    rows.push({
      groupKey,
      groupId: parseMinivagasGroupId(groupKey),
      memberCount: Math.max(1, members.length),
      members,
      cnpjDigits: rep?.cnpjDigits || groupKey,
      companyId: rep?.companyId ?? null,
      companyName: counts.name,
      onMap: Boolean(rep?.onMap),
      reputation,
    });
  }

  const sorted = rows.sort(
    (a, b) =>
      (b.reputation.hireRate ?? -1) - (a.reputation.hireRate ?? -1) ||
      b.reputation.decididos - a.reputation.decididos ||
      b.reputation.enviados - a.reputation.enviados ||
      a.companyName.localeCompare(b.companyName, 'pt-BR')
  );
  return limit != null ? sorted.slice(0, limit) : sorted;
}

export function reputationCriteria(label: ReputationLabel): string {
  switch (label) {
    case 'Excelente':
      return 'Taxa de contratação de 40% ou mais';
    case 'Boa':
      return 'Taxa de contratação entre 25% e 39%';
    case 'Regular':
      return 'Taxa de contratação entre 15% e 24%';
    case 'Atenção':
      return 'Taxa de contratação entre 8% e 14%';
    case 'Crítica':
      return 'Taxa de contratação abaixo de 8%';
    default:
      return 'Ainda sem resultado após entrevista';
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

  // Volume: sempre tags ao vivo (bate com a listagem do Minivagas)
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
  const groupIndex = buildMinivagasGroupIndex(users);

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
    groupIndex,
    reprovadosEmpresa,
    contratados,
    naoCompareceu,
    emEntrevista
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
    reprovadosEmpresa,
    contratados,
    naoCompareceu,
    emEntrevista
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
    topRejecters: buildSingleSideRanking(
      companies,
      volumeReprovados,
      groupIndex,
      null,
      hiringByCnpj
    ),
    topHired: buildSingleSideRanking(
      companies,
      volumeContratados,
      groupIndex,
      null,
      hiringByCnpj
    ),
    topNoShows: buildSingleSideRanking(
      companies,
      volumeNaoCompareceu,
      groupIndex,
      null,
      hiringByCnpj
    ),
    topRejectersMonth: buildSingleSideRanking(
      companies,
      volumeReprovadosMes,
      groupIndex,
      null,
      hiringByCnpjMonth
    ),
    topHiredMonth: buildSingleSideRanking(
      companies,
      volumeContratadosMes,
      groupIndex,
      null,
      hiringByCnpjMonth
    ),
    topNoShowsMonth: buildSingleSideRanking(
      companies,
      volumeNaoCompareceuMes,
      groupIndex,
      null,
      hiringByCnpjMonth
    ),
    topReputation: buildReputationRanking(companies, groupIndex, reputationByGroup, {
      minDecided: 0,
      statsByCnpj: reputationStatsByCnpj,
    }),
    topReputationMonth: buildReputationRanking(companies, groupIndex, reputationByGroupMonth, {
      minDecided: 0,
      statsByCnpj: reputationStatsByCnpjMonth,
    }),
    matchedObservacoes,
    matchedHiring,
    totals: {
      reprovados: volumeReprovados.length,
      contratados: volumeContratados.length,
      naoCompareceu: volumeNaoCompareceu.length,
      emFunil: emEntrevista.length,
      enviados: useFreeze
        ? new Set(
            [...reprovadosEmpresa, ...contratados, ...naoCompareceu, ...emEntrevista].map(
              candidatoJobKey
            )
          ).size
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
