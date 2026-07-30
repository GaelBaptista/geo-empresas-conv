import { api } from '@/lib/api';
import { isCompanyVisitScheduleTitle } from '@/lib/schedule-match';
import type { ApiListResponse, ApiSchedule } from '@/types/api';
import type { ScheduleItem } from '@/types';

function unwrapList<T>(payload: ApiListResponse<T> | unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** Junta date (ISO) + hour ("14:00:00") no horário local interpretado. */
function combineDateAndHour(dateRaw?: string | null, hourRaw?: string | null): string {
  const dateStr = (dateRaw || '').trim();
  if (!dateStr) return '';

  const hourStr = (hourRaw || '').trim();
  const day = dateStr.slice(0, 10); // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    if (hourStr && /^\d{1,2}:\d{2}/.test(hourStr)) {
      const [hh, mm, ss] = hourStr.split(':');
      parsed.setHours(Number(hh) || 0, Number(mm) || 0, Number(ss) || 0, 0);
    }
    return parsed.toISOString();
  }

  if (hourStr && /^\d{1,2}:\d{2}/.test(hourStr)) {
    const [hh, mm, ss] = hourStr.split(':');
    const local = new Date(
      Number(day.slice(0, 4)),
      Number(day.slice(5, 7)) - 1,
      Number(day.slice(8, 10)),
      Number(hh) || 0,
      Number(mm) || 0,
      Number(ss) || 0
    );
    return local.toISOString();
  }

  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? dateStr : parsed.toISOString();
}

export function mapApiScheduleToItem(raw: ApiSchedule): ScheduleItem {
  // No Estagius o texto principal vem em `description` (ex.: "Visita ao supermercado X")
  const title =
    pickString(raw.description, raw.title, raw.name) || 'Agendamento';
  const notes = pickString(raw.observations, raw.notes) || undefined;
  const type =
    pickString(raw.type) ||
    (raw.category != null ? `categoria-${raw.category}` : 'agenda');
  const status = pickString(raw.status) || (raw.private ? 'privado' : 'agendado');
  const startsAt =
    combineDateAndHour(raw.date, raw.hour) ||
    pickString(raw.start_at, raw.start_date, raw.scheduled_at) ||
    new Date().toISOString();
  const endsAt = pickString(raw.ends_at, raw.end_date) || undefined;
  const responsibleName =
    pickString(
      raw.createdBy,
      raw.responsible,
      raw.user && typeof raw.user === 'object' ? raw.user.name : null
    ) || undefined;

  const companyObj =
    raw.company && typeof raw.company === 'object' ? raw.company : null;

  const apiCompanyIdRaw = raw.company_id ?? companyObj?.id ?? null;
  const apiCompanyIdNum = Number(apiCompanyIdRaw);
  const apiCompanyId =
    apiCompanyIdRaw != null &&
    apiCompanyIdRaw !== '' &&
    Number.isFinite(apiCompanyIdNum)
      ? apiCompanyIdNum
      : null;

  const apiCompanyName =
    pickString(
      raw.company_name,
      companyObj?.fantasy_name,
      companyObj?.company_name
    ) || null;

  // Visita se o título indicar OU se já tiver empresa selecionada no Estagius
  const isVisit =
    isCompanyVisitScheduleTitle(title) ||
    apiCompanyId != null ||
    Boolean(apiCompanyName);

  return {
    id: String(raw.id),
    title,
    description: notes,
    observations: notes,
    type,
    status,
    startsAt,
    endsAt,
    responsibleName,
    apiCompanyId,
    apiCompanyName,
    extractedCompanyName: apiCompanyName,
    matchedCompanyId: null,
    matchedCompanyName: null,
    isVisit,
    matchConfidence: 'none',
  };
}

export async function fetchSchedules(options?: { me?: boolean }): Promise<ScheduleItem[]> {
  const me = options?.me ?? false;
  const { data } = await api.get<ApiListResponse<ApiSchedule>>('/schedules', {
    params: { me },
  });
  return unwrapList<ApiSchedule>(data).map(mapApiScheduleToItem);
}
