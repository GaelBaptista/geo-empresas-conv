/** Helpers e agregações do Dashboard TV (sem UI). */

import { months } from '@/data/dashboard-tv-months';

export type UF = 'ce' | 'rn' | 'outros';

export type StatusKey =
  | 'triados'
  | 'entrevista_online'
  | 'entrevista_presencial'
  | 'reprovados'
  | 'nao_compareceram'
  | 'aprovados'
  | 'contratados';

export type DayKey =
  | 'segunda-feira'
  | 'terça-feira'
  | 'quarta-feira'
  | 'quinta-feira'
  | 'sexta-feira';

export const DAYS: DayKey[] = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
];

export const FIXED_WEEK_DAYS = DAYS;

export type StatusCounts = Record<StatusKey, number>;
export type DayCounts = Record<DayKey, StatusCounts>;

export type WeeklyState = {
  totals: StatusCounts;
  byDay: DayCounts;
};

export type WeeklyByUF = {
  ce: WeeklyState;
  rn: WeeklyState;
  outros: WeeklyState;
  outrosUFs?: Record<string, number>;
};

export type WeeklyMoves = Record<StatusKey, AnyRecord[]>;

export type Hire = AnyRecord;

export type HiresTodayAgg = {
  hiresTodayCE: number;
  hiresTodayRN: number;
  hiresTodayOutros: number;
  processosPreenchidosHojeCE: number;
  processosPreenchidosHojeRN: number;
  processosPreenchidosHojeOutros: number;
};

export type HiresWeekDay = {
  day: DayKey;
  ce: { vagas: number; preenchidos: number };
  rn: { vagas: number; preenchidos: number };
  outros: { vagas: number; preenchidos: number };
};

type AnyRecord = Record<string, unknown>;

export function blankStatus(): StatusCounts {
  return {
    triados: 0,
    entrevista_online: 0,
    entrevista_presencial: 0,
    reprovados: 0,
    nao_compareceram: 0,
    aprovados: 0,
    contratados: 0,
  };
}

export function blankWeeklyState(): WeeklyState {
  return {
    totals: blankStatus(),
    byDay: {
      'segunda-feira': blankStatus(),
      'terça-feira': blankStatus(),
      'quarta-feira': blankStatus(),
      'quinta-feira': blankStatus(),
      'sexta-feira': blankStatus(),
    },
  };
}

export function toLocalISODate(dateLike?: string | number | Date | null): string | null {
  if (dateLike == null) return null;
  if (dateLike instanceof Date) {
    if (Number.isNaN(dateLike.getTime())) return null;
    const y = dateLike.getFullYear();
    const m = String(dateLike.getMonth() + 1).padStart(2, '0');
    const d = String(dateLike.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof dateLike === 'string') {
    const only = toISODateOnly(dateLike);
    if (only) return only;
  }
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalISODate(d);
}

export function todayLocalISO(): string {
  return toLocalISODate(new Date())!;
}

export function toISODateOnly(s?: string | null): string | null {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function pickMovementISO(it: AnyRecord): string | null {
  const ultima = it?.ultima_acao as { data?: string } | undefined;
  const raw =
    ultima?.data ||
    (it?.moved_at as string | undefined) ||
    (it?.updated_at as string | undefined) ||
    (it?.created_at as string | undefined) ||
    null;
  return raw ?? null;
}

export function getThisMonday(base = new Date()): Date {
  const monday = new Date(base);
  const dayIdx = base.getDay() === 0 ? 7 : base.getDay();
  monday.setDate(base.getDate() - dayIdx + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function currentWeekBounds(now: Date = new Date()): {
  monISO: string;
  friISO: string;
  monId: string;
} {
  const mon = getThisMonday(now);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  fri.setHours(23, 59, 59, 999);
  const monISO = toLocalISODate(mon)!;
  return { monISO, friISO: toLocalISODate(fri)!, monId: monISO };
}

function normalizeUF(s?: string | null): UF {
  if (!s) return 'outros';
  const v = String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (
    v === 'ce' ||
    v.includes('ceara') ||
    v.includes('fortaleza') ||
    v.includes('aracati') ||
    v.includes('juazeiro') ||
    v.includes('sobral')
  ) {
    return 'ce';
  }

  if (
    v === 'rn' ||
    v.includes('rio grande do norte') ||
    v.includes('natal') ||
    v.includes('mossoro')
  ) {
    return 'rn';
  }

  return 'outros';
}

function ufByRecruiterName(name: string): UF {
  const v = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return v.includes('jaerly') ? 'rn' : 'ce';
}

export function ufFromItem(item: AnyRecord): UF {
  const raw =
    (item?.job_posting as { estado?: string } | undefined)?.estado ||
    (item?.address_state as string | undefined) ||
    (item?.estado as string | undefined) ||
    (item?.state as string | undefined) ||
    (item?.company as { state?: string } | undefined)?.state ||
    (item?.empresa as { estado?: string } | undefined)?.estado ||
    null;

  if (raw) return normalizeUF(raw);

  const recruiter =
    (item?.job_posting as { recrutador?: string; recruiter?: string } | undefined)?.recrutador ||
    (item?.recrutador as string | undefined) ||
    (item?.job_posting as { recruiter?: string } | undefined)?.recruiter ||
    '';

  if (recruiter) return ufByRecruiterName(String(recruiter));
  return 'outros';
}

export function getStateFromHire(h: AnyRecord): UF {
  return ufFromItem(h);
}

export function getHireDateISO(h: AnyRecord): string | null {
  return (
    toLocalISODate(h?.updated_at as string | undefined) ||
    toLocalISODate(h?.contratado_em as string | undefined) ||
    toLocalISODate(h?.hired_at as string | undefined) ||
    toLocalISODate(h?.created_at as string | undefined) ||
    null
  );
}

export function getProcessIdFromHire(h: AnyRecord): string | number | null {
  const posting = h?.job_posting as { id?: number } | undefined;
  return (
    (h?.job_posting_id as number | undefined) ||
    posting?.id ||
    (h?.process_id as number | undefined) ||
    (h?.processo_id as number | undefined) ||
    (h?.vaga_id as number | undefined) ||
    null
  );
}

export function normalizeToArray(raw: unknown): AnyRecord[] {
  if (Array.isArray(raw)) return raw as AnyRecord[];
  if (raw && typeof raw === 'object') {
    const obj = raw as { data?: unknown; items?: unknown };
    if (Array.isArray(obj.data)) return obj.data as AnyRecord[];
    if (Array.isArray(obj.items)) return obj.items as AnyRecord[];
  }
  return [];
}

export function extractRealUF(item: AnyRecord): string | null {
  const posting = item?.job_posting as { estado?: string } | undefined;
  const raw =
    posting?.estado ||
    (item?.address_state as string | undefined) ||
    (item?.estado as string | undefined) ||
    (item?.state as string | undefined) ||
    (item?.company as { state?: string } | undefined)?.state ||
    (item?.empresa as { estado?: string } | undefined)?.estado ||
    null;

  if (!raw) return null;

  const v = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (v.length === 2) return v.toUpperCase();

  const stateMap: Record<string, string> = {
    ceara: 'CE',
    fortaleza: 'CE',
    aracati: 'CE',
    juazeiro: 'CE',
    sobral: 'CE',
    'rio grande do norte': 'RN',
    natal: 'RN',
    mossoro: 'RN',
    paraiba: 'PB',
    'joao pessoa': 'PB',
    pernambuco: 'PE',
    recife: 'PE',
    'sao paulo': 'SP',
    'rio de janeiro': 'RJ',
    'minas gerais': 'MG',
    bahia: 'BA',
    parana: 'PR',
    goias: 'GO',
    maranhao: 'MA',
    piaui: 'PI',
  };

  for (const [key, uf] of Object.entries(stateMap)) {
    if (v.includes(key)) return uf;
  }
  return null;
}

function isoToDayKey(iso: string | null): DayKey | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  switch (dt.getDay()) {
    case 1:
      return 'segunda-feira';
    case 2:
      return 'terça-feira';
    case 3:
      return 'quarta-feira';
    case 4:
      return 'quinta-feira';
    case 5:
      return 'sexta-feira';
    default:
      return null;
  }
}

function buildWeeklyLiveFromMoves(moves: WeeklyMoves): WeeklyByUF {
  const wb: WeeklyByUF = {
    ce: blankWeeklyState(),
    rn: blankWeeklyState(),
    outros: blankWeeklyState(),
    outrosUFs: {},
  };

  const { monISO, friISO } = currentWeekBounds();
  const inRange = (isoOnly: string | null) =>
    !!isoOnly && isoOnly >= monISO && isoOnly <= friISO;

  const add = (items: AnyRecord[], key: StatusKey) => {
    (items || []).forEach((it) => {
      const isoOnly = toISODateOnly(pickMovementISO(it));
      if (!inRange(isoOnly)) return;
      const dayKey = isoToDayKey(isoOnly);
      if (!dayKey) return;

      const uf = ufFromItem(it);
      const targetUF = uf === 'ce' || uf === 'rn' ? uf : 'outros';

      wb[targetUF].byDay[dayKey][key] += 1;
      wb[targetUF].totals[key] += 1;

      if (targetUF === 'outros' && key === 'contratados') {
        const realUF = extractRealUF(it);
        if (realUF && realUF !== 'CE' && realUF !== 'RN') {
          wb.outrosUFs![realUF] = (wb.outrosUFs![realUF] || 0) + 1;
        }
      }
    });
  };

  add(moves.triados, 'triados');
  add(moves.entrevista_online, 'entrevista_online');
  add(moves.entrevista_presencial, 'entrevista_presencial');
  add(moves.reprovados, 'reprovados');
  add(moves.nao_compareceram, 'nao_compareceram');
  add(moves.aprovados, 'aprovados');
  add(moves.contratados, 'contratados');

  return wb;
}

type Snapshot = Record<'ce' | 'rn' | 'outros', DayCounts>;
const STORAGE_VERSION = 'v2';

function storageKey(weekMonId: string) {
  return `weeklyFreeze:${STORAGE_VERSION}:${weekMonId}`;
}

function readSnapshots(weekMonId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(weekMonId));
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

function writeSnapshots(weekMonId: string, snap: Snapshot) {
  try {
    localStorage.setItem(storageKey(weekMonId), JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

function recomputeTotals(ws: WeeklyState): WeeklyState {
  const t = blankStatus();
  for (const d of DAYS) {
    const row = ws.byDay[d];
    (Object.keys(t) as StatusKey[]).forEach((k) => {
      t[k] += row[k];
    });
  }
  return { totals: t, byDay: ws.byDay };
}

async function buildWeeklyFrozen(live: WeeklyByUF): Promise<WeeklyByUF> {
  const { monId } = currentWeekBounds();
  const todayDow = (new Date().getDay() || 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7;

  let snap = readSnapshots(monId);
  if (!snap) {
    snap = {
      ce: {
        'segunda-feira': blankStatus(),
        'terça-feira': blankStatus(),
        'quarta-feira': blankStatus(),
        'quinta-feira': blankStatus(),
        'sexta-feira': blankStatus(),
      },
      rn: {
        'segunda-feira': blankStatus(),
        'terça-feira': blankStatus(),
        'quarta-feira': blankStatus(),
        'quinta-feira': blankStatus(),
        'sexta-feira': blankStatus(),
      },
      outros: {
        'segunda-feira': blankStatus(),
        'terça-feira': blankStatus(),
        'quarta-feira': blankStatus(),
        'quinta-feira': blankStatus(),
        'sexta-feira': blankStatus(),
      },
    };
  }

  const lastDayIdx = Math.min(todayDow - 1, 5);
  const dayIdxMap: Record<1 | 2 | 3 | 4 | 5, DayKey> = {
    1: 'segunda-feira',
    2: 'terça-feira',
    3: 'quarta-feira',
    4: 'quinta-feira',
    5: 'sexta-feira',
  };

  const out: WeeklyByUF = {
    ce: blankWeeklyState(),
    rn: blankWeeklyState(),
    outros: blankWeeklyState(),
    outrosUFs: live.outrosUFs || {},
  };

  (['ce', 'rn', 'outros'] as const).forEach((uf) => {
    for (let i = 1 as 1 | 2 | 3 | 4 | 5; i <= 5; i = (i + 1) as 1 | 2 | 3 | 4 | 5) {
      const dayKey = dayIdxMap[i];
      if (i <= lastDayIdx) {
        if (snap && snap[uf] && snap[uf][dayKey]) {
          const hasSnap = Object.values(snap[uf][dayKey]).some((v) => v > 0);
          if (!hasSnap) snap[uf][dayKey] = { ...live[uf].byDay[dayKey] };
          out[uf].byDay[dayKey] = { ...snap[uf][dayKey] };
        } else {
          out[uf].byDay[dayKey] = { ...live[uf].byDay[dayKey] };
        }
      } else {
        out[uf].byDay[dayKey] = { ...live[uf].byDay[dayKey] };
      }
    }
    out[uf] = recomputeTotals(out[uf]);
  });

  if (snap) writeSnapshots(monId, snap);
  return out;
}

export async function fetchWeeklyStatusByUFWithMoves(
  moves: WeeklyMoves
): Promise<WeeklyByUF> {
  return buildWeeklyFrozen(buildWeeklyLiveFromMoves(moves));
}

export function aggregateHiresToday(hires: Hire[]): HiresTodayAgg {
  const today = todayLocalISO();
  const onlyHired = (hires || []).filter(
    (h) => String(h?.status).toLowerCase() === 'contratado'
  );

  const countByUF = (uf: UF) =>
    onlyHired.filter((h) => getHireDateISO(h) === today && getStateFromHire(h) === uf);

  const ce = countByUF('ce');
  const rn = countByUF('rn');
  const outros = countByUF('outros');

  const processesCE = new Set(ce.map((h) => getProcessIdFromHire(h)).filter(Boolean));
  const processesRN = new Set(rn.map((h) => getProcessIdFromHire(h)).filter(Boolean));
  const processesOutros = new Set(
    outros.map((h) => getProcessIdFromHire(h)).filter(Boolean)
  );

  return {
    hiresTodayCE: ce.length,
    hiresTodayRN: rn.length,
    hiresTodayOutros: outros.length,
    processosPreenchidosHojeCE: processesCE.size || ce.length,
    processosPreenchidosHojeRN: processesRN.size || rn.length,
    processosPreenchidosHojeOutros: processesOutros.size || outros.length,
  };
}

export function aggregateHiresWeek(hires: Hire[]): HiresWeekDay[] {
  const monday = getThisMonday(new Date());
  const daysMap: Record<string, string> = {};
  FIXED_WEEK_DAYS.forEach((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    daysMap[label] = toLocalISODate(d)!;
  });

  const onlyHired = (hires || []).filter(
    (h) => String(h?.status).toLowerCase() === 'contratado'
  );

  return FIXED_WEEK_DAYS.map((label) => {
    const iso = daysMap[label];
    const dayHires = onlyHired.filter((h) => getHireDateISO(h) === iso);
    const byUF = (uf: UF) => dayHires.filter((h) => getStateFromHire(h) === uf);
    const ce = byUF('ce');
    const rn = byUF('rn');
    const outros = byUF('outros');

    const procCE = new Set(ce.map((h) => getProcessIdFromHire(h)).filter(Boolean));
    const procRN = new Set(rn.map((h) => getProcessIdFromHire(h)).filter(Boolean));
    const procOutros = new Set(outros.map((h) => getProcessIdFromHire(h)).filter(Boolean));

    return {
      day: label,
      ce: { vagas: ce.length, preenchidos: procCE.size || ce.length },
      rn: { vagas: rn.length, preenchidos: procRN.size || rn.length },
      outros: {
        vagas: outros.length,
        preenchidos: procOutros.size || outros.length,
      },
    };
  });
}

export function countMovedToday(items: AnyRecord[]): number {
  const today = todayLocalISO();
  return (items || []).filter((x) => toISODateOnly(pickMovementISO(x)) === today).length;
}

export function normText(s: string): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const REFRESH_INTERVAL_KEY = 'tv_dashboard_refresh_min';
export const REFRESH_MIN_DEFAULT = 1;
export const REFRESH_MIN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function readRefreshMin(): number {
  const raw = localStorage.getItem(REFRESH_INTERVAL_KEY);
  const n = Number(raw);
  return REFRESH_MIN_OPTIONS.includes(n) ? n : REFRESH_MIN_DEFAULT;
}

export function writeRefreshMin(min: number) {
  localStorage.setItem(REFRESH_INTERVAL_KEY, String(min));
}

export function getMonthStart(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function getMonthEnd(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function isInMonth(
  dateISO: string | null,
  monthStart: string,
  monthEnd: string
): boolean {
  if (!dateISO) return false;
  return dateISO >= monthStart && dateISO <= monthEnd;
}

export function shiftMonthISO(dateISO: string, delta: number): string {
  const d = new Date(dateISO);
  d.setMonth(d.getMonth() + delta);
  return toLocalISODate(d) || dateISO;
}

export function formatMonthYearPt(dateISO: string): string {
  const d = new Date(dateISO);
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getDashboardTvTodayMessage(now: Date = new Date()): string {
  const day = now.getDate();
  const monthIndex = now.getMonth();
  const monthData = months[monthIndex];
  if (!monthData) return 'Tenha um ótimo dia!';

  const sources = [
    monthData.birthdays?.[day],
    monthData.payments?.[day],
    monthData.stateHolidays?.[day],
    monthData.specials?.[day],
    monthData.days?.[day],
  ];

  for (const source of sources) {
    if (source?.message) return source.message;
    if (source?.label) return source.label;
  }

  return 'Tenha um ótimo dia!';
}

