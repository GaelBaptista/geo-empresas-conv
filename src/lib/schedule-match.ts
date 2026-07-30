import { getCompanyDisplayName } from '@/lib/company';
import { getCachedUserLocation } from '@/lib/user-location';
import type { Company, ScheduleItem } from '@/types';

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeMatchText(value: string | null | undefined): string {
  return stripAccents(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai o nome da empresa dos padrões usados no Estagius:
 * - "CAPTAÇÃO SUPERMERCADO MERCADINHO BOM D+"
 * - "ACOMPANHAMENTO MORANGUINHO BURITI"
 * - "VISITA DE ACOMPANHAMENTO SUPERMERCADO X"
 * - "Visita ao supermercado X" / "Visita de acompanhamento a X"
 */
export function extractCompanyNameFromTitle(title: string): string | null {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  const patterns = [
    // CAPTAÇÃO SUPERMERCADO NOME / CAPTACAO SUPERMERCADO NOME
    /^(?:capta[cç][aã]o)\s+(?:supermercado|mercado)?\s*[;:\-]?\s*(.+)$/i,
    // ACOMPANHAMENTO NOME  (com ou sem separador)
    /^(?:acompanhamento)\s*[;:\-]?\s*(.+)$/i,
    // VISITA DE ACOMPANHAMENTO NOME / VISITA DE ACOMPANHAMENTO SUPERMERCADO NOME
    /^(?:visita\s+de\s+acompanhamento)\s+(?:supermercado|mercado)?\s*[;:\-]?\s*(.+)$/i,
    // Visita de acompanhamento a NOME
    /visita(?:\s+de\s+[\wÀ-ÿ]+(?:\s+[\wÀ-ÿ]+){0,4})?\s+a[oà]?\s+(.+)$/i,
    /visita\s+a[oà]?\s+(.+)$/i,
    /acompanhamento\s+a[oà]?\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match?.[1]) continue;

    let name = match[1].replace(/[.,;:!?]+$/, '').trim();
    // remove tipo de estabelecimento no início do nome
    name = name
      .replace(
        /^(supermercado|mercado|empresa|loja|cl[ií]nica|farm[aá]cia|hospital|escola|faculdade|col[eé]gio|padaria|restaurante)\s+/i,
        ''
      )
      .trim();

    // evita capturar só a palavra-chave
    if (/^(supermercado|mercado|empresa|visita|acompanhamento|capta)/i.test(name)) {
      continue;
    }

    if (name.length >= 2) return name;
  }

  return null;
}

/** Agenda relacionada a visita/captação/acompanhamento de empresa (para o mapa). */
export function isCompanyVisitScheduleTitle(title: string): boolean {
  const t = normalizeMatchText(title);
  if (!t) return false;
  return (
    /\bvisita\b/.test(t) ||
    /\bacompanhamento\b/.test(t) ||
    /\bcaptac[aã]o\b/.test(t) ||
    /\bcaptacao\b/.test(t)
  );
}

/** Tem empresa selecionada no Estagius ou vinculada no mapa. */
export function hasScheduleCompanySelected(schedule: ScheduleItem): boolean {
  if (schedule.apiCompanyId != null) return true;
  if (schedule.matchedCompanyId) return true;
  if ((schedule.apiCompanyName || '').trim()) return true;
  return false;
}

/** Reunião online / videochamada — não entra na agenda de visitas de campo. */
export function isOnlineMeetingSchedule(schedule: ScheduleItem): boolean {
  const text = [
    schedule.title,
    schedule.observations,
    schedule.description,
    schedule.type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    /meet\.google\.com/.test(text) ||
    /zoom\.us/.test(text) ||
    /teams\.microsoft/.test(text) ||
    /videochamada/.test(text) ||
    /videoconfer/.test(text) ||
    /reuni[aã]o online/.test(text) ||
    (/link da video/.test(text) && /http/.test(text))
  );
}

/** Itens que devem aparecer na tela de Agenda (empresa selecionada, sem reunião online). */
export function isFieldAgendaSchedule(schedule: ScheduleItem): boolean {
  if (!hasScheduleCompanySelected(schedule)) return false;
  if (isOnlineMeetingSchedule(schedule)) return false;
  return true;
}

type ScoredMatch = {
  company: Company;
  score: number;
  confidence: ScheduleItem['matchConfidence'];
};

function scoreNameAgainstCompany(extracted: string, company: Company): ScoredMatch | null {
  const needle = normalizeMatchText(extracted);
  if (!needle || needle.length < 2) return null;

  const fantasy = normalizeMatchText(company.tradeName);
  const legal = normalizeMatchText(company.name);
  const display = normalizeMatchText(getCompanyDisplayName(company));

  if (fantasy && fantasy === needle) {
    return { company, score: 100, confidence: 'exact' };
  }
  if (display && display === needle) {
    return { company, score: 98, confidence: 'exact' };
  }
  if (legal && legal === needle) {
    return { company, score: 90, confidence: 'exact' };
  }

  let score = 0;
  let confidence: ScheduleItem['matchConfidence'] = 'fuzzy';

  if (fantasy && (fantasy.includes(needle) || needle.includes(fantasy))) {
    score = Math.max(score, 75 + Math.min(fantasy.length, needle.length) / 10);
  }
  if (display && (display.includes(needle) || needle.includes(display))) {
    score = Math.max(score, 70 + Math.min(display.length, needle.length) / 10);
  }
  if (legal && (legal.includes(needle) || needle.includes(legal))) {
    score = Math.max(score, 55 + Math.min(legal.length, needle.length) / 10);
  }

  // Tokens: exige maioria das palavras do nome extraído
  const tokens = needle.split(' ').filter((t) => t.length > 2);
  if (tokens.length > 0) {
    const hay = `${fantasy} ${legal} ${display}`;
    const hit = tokens.filter((t) => hay.includes(t)).length;
    const ratio = hit / tokens.length;
    if (ratio >= 0.75) {
      score = Math.max(score, 50 + ratio * 20);
    }
  }

  if (score < 50) return null;
  return { company, score, confidence };
}

function bestNameMatch(
  needle: string,
  companies: Company[]
): ScoredMatch | null {
  const scored: ScoredMatch[] = [];
  for (const company of companies) {
    const result = scoreNameAgainstCompany(needle, company);
    if (result) scored.push(result);
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.company.activeTrainees ?? 0) - (a.company.activeTrainees ?? 0);
  });
  return scored[0];
}

/**
 * Casa agenda ↔ mapa nesta ordem:
 * 1) company_id da API (seleção no Estagius)
 * 2) company_name / fantasy_name da agenda
 * 3) nome extraído do título (legado)
 */
export function matchScheduleToCompany(
  schedule: ScheduleItem,
  companies: Company[]
): ScheduleItem {
  // 1) ID oficial da empresa selecionada na agenda
  if (schedule.apiCompanyId != null) {
    const byId = companies.find((c) => c.apiId === schedule.apiCompanyId);
    if (byId) {
      return {
        ...schedule,
        matchedCompanyId: byId.id,
        matchedCompanyName: getCompanyDisplayName(byId),
        matchConfidence: 'id',
        extractedCompanyName:
          schedule.apiCompanyName ||
          schedule.extractedCompanyName ||
          getCompanyDisplayName(byId),
      };
    }
  }

  // 2) Nome que veio junto na agenda (company_name / company.company_name)
  const nameFromApi = (schedule.apiCompanyName || '').trim();
  if (nameFromApi) {
    const best = bestNameMatch(nameFromApi, companies);
    if (best) {
      return {
        ...schedule,
        extractedCompanyName: nameFromApi,
        matchedCompanyId: best.company.id,
        matchedCompanyName: getCompanyDisplayName(best.company),
        matchConfidence: best.confidence,
      };
    }
  }

  // 3) Fallback: extrair do título (CAPTAÇÃO X, Visita ao Y, …)
  const nameFromTitle = extractCompanyNameFromTitle(schedule.title);
  if (!nameFromTitle) {
    return {
      ...schedule,
      extractedCompanyName: nameFromApi || null,
      matchedCompanyId: null,
      matchedCompanyName: null,
      matchConfidence: 'none',
    };
  }

  const best = bestNameMatch(nameFromTitle, companies);
  if (!best) {
    return {
      ...schedule,
      extractedCompanyName: nameFromTitle,
      matchedCompanyId: null,
      matchedCompanyName: null,
      matchConfidence: 'none',
    };
  }

  return {
    ...schedule,
    extractedCompanyName: nameFromTitle,
    matchedCompanyId: best.company.id,
    matchedCompanyName: getCompanyDisplayName(best.company),
    matchConfidence: best.confidence,
  };
}

export function matchSchedulesToCompanies(
  schedules: ScheduleItem[],
  companies: Company[]
): ScheduleItem[] {
  return schedules.map((item) => matchScheduleToCompany(item, companies));
}

export function isUpcomingSchedule(schedule: ScheduleItem, now = new Date()): boolean {
  const start = new Date(schedule.startsAt);
  if (Number.isNaN(start.getTime())) return false;
  if (isCancelledOrDone(schedule)) return false;
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  return start.getTime() >= dayStart.getTime();
}

function isCancelledOrDone(schedule: ScheduleItem): boolean {
  const status = schedule.status.toLowerCase();
  return (
    status.includes('cancel') ||
    status.includes('conclu') ||
    status.includes('done') ||
    status.includes('complet')
  );
}

export type VisitWindow = 'upcoming' | 'today' | 'week';

export function isInVisitWindow(
  schedule: ScheduleItem,
  window: VisitWindow,
  now = new Date()
): boolean {
  if (!schedule.isVisit || isCancelledOrDone(schedule)) return false;
  const start = new Date(schedule.startsAt);
  if (Number.isNaN(start.getTime())) return false;

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  if (window === 'today') {
    return start >= dayStart && start < dayEnd;
  }

  if (window === 'week') {
    const weekEnd = new Date(dayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return start >= dayStart && start < weekEnd;
  }

  // upcoming: a partir de hoje
  return start >= dayStart;
}

export function getVisitSchedulesInWindow(
  schedules: ScheduleItem[],
  window: VisitWindow
): ScheduleItem[] {
  return schedules
    .filter((s) => isInVisitWindow(s, window))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function companyIdsWithVisitsInWindow(
  schedules: ScheduleItem[],
  window: VisitWindow
): Set<string> {
  const ids = new Set<string>();
  getVisitSchedulesInWindow(schedules, window).forEach((s) => {
    if (s.matchedCompanyId) ids.add(s.matchedCompanyId);
  });
  return ids;
}

export function getUpcomingVisitSchedules(schedules: ScheduleItem[]): ScheduleItem[] {
  return getVisitSchedulesInWindow(schedules, 'upcoming');
}

export function companyIdsWithUpcomingVisits(schedules: ScheduleItem[]): Set<string> {
  return companyIdsWithVisitsInWindow(schedules, 'upcoming');
}

export function nextVisitForCompany(
  schedules: ScheduleItem[],
  companyId: string,
  window: VisitWindow = 'upcoming'
): ScheduleItem | null {
  const upcoming = getVisitSchedulesInWindow(schedules, window).filter(
    (s) => s.matchedCompanyId === companyId
  );
  return upcoming[0] || null;
}

export function formatScheduleDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ordena visitas do dia por proximidade a partir do usuário (ou do centro médio). */
export function orderDayRouteByProximity(
  visits: ScheduleItem[],
  companies: Company[],
  startFrom?: { lat: number; lng: number } | null
): Array<{ schedule: ScheduleItem; company: Company; kmFromPrev: number }> {
  const points = visits
    .map((schedule) => {
      const company = companies.find((c) => c.id === schedule.matchedCompanyId);
      return company ? { schedule, company } : null;
    })
    .filter(Boolean) as Array<{ schedule: ScheduleItem; company: Company }>;

  if (points.length === 0) return [];

  const center = {
    lat: points.reduce((s, p) => s + p.company.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.company.lng, 0) / points.length,
  };

  const remaining = [...points];
  const ordered: Array<{ schedule: ScheduleItem; company: Company; kmFromPrev: number }> = [];
  let current = startFrom ?? center;
  let isFirst = true;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestKm = Infinity;
    remaining.forEach((p, i) => {
      const km = haversineKm(current, { lat: p.company.lat, lng: p.company.lng });
      if (km < bestKm) {
        bestKm = km;
        bestIdx = i;
      }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push({
      schedule: next.schedule,
      company: next.company,
      kmFromPrev: isFirst && startFrom ? bestKm : isFirst ? 0 : bestKm,
    });
    isFirst = false;
    current = { lat: next.company.lat, lng: next.company.lng };
  }

  return ordered;
}

/**
 * Link do Google Maps até o endereço.
 * Origem: GPS do usuário ou centro de Fortaleza (padrão).
 */
export function googleMapsDestinationUrl(
  address: string,
  origin?: { lat: number; lng: number } | null
): string {
  const query = address.trim();
  if (!query) return 'https://www.google.com/maps';

  const from = origin ?? getCachedUserLocation();
  const params = new URLSearchParams({
    api: '1',
    destination: query,
    origin: `${from.lat},${from.lng}`,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleMapsCompanyUrl(
  company: Company,
  origin?: { lat: number; lng: number } | null
): string {
  return googleMapsDestinationUrl(company.address, origin);
}

/** Rota multi-parada partindo do GPS ou de Fortaleza. */
export function googleMapsRouteUrl(
  addresses: string[],
  origin?: { lat: number; lng: number } | null
): string | null {
  const cleaned = addresses.map((a) => a.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  const from = origin ?? getCachedUserLocation();
  if (cleaned.length === 1) return googleMapsDestinationUrl(cleaned[0], from);

  const destination = cleaned[cleaned.length - 1];
  const waypoints = cleaned.slice(0, -1).join('|');
  const params = new URLSearchParams({
    api: '1',
    origin: `${from.lat},${from.lng}`,
    destination,
  });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function applyManualMatches(
  schedules: ScheduleItem[],
  companies: Company[],
  manual: Record<string, string>
): ScheduleItem[] {
  return schedules.map((item) => {
    const companyId = manual[item.id];
    if (!companyId) return item;
    const company = companies.find((c) => c.id === companyId);
    if (!company) return item;
    return {
      ...item,
      matchedCompanyId: company.id,
      matchedCompanyName: getCompanyDisplayName(company),
      matchConfidence: 'manual',
      isVisit: true,
    };
  });
}
