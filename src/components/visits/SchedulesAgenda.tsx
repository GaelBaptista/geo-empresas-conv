import { useMemo, useState } from 'react';
import {
  Building2,
  AlertCircle,
  MapPin,
  Link2,
  Unlink,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  Target,
  CalendarDays,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { getCompanyDisplayName } from '@/lib/company';
import { formatScheduleDate, isFieldAgendaSchedule } from '@/lib/schedule-match';
import { cn } from '@/lib/utils';
import type { Company, ScheduleItem } from '@/types';

interface SchedulesAgendaProps {
  schedules: ScheduleItem[];
  companies: Company[];
  onSelectCompanyById: (companyId: string) => void;
  onFocusCompanyOnMap?: (companyId: string) => void;
  onLinkCompany?: (scheduleId: string, companyId: string) => void;
  onUnlinkCompany?: (scheduleId: string) => void;
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function scheduleDay(item: ScheduleItem): Date | null {
  const d = new Date(item.startsAt);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
}

function formatDayLong(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function SchedulesAgenda({
  schedules,
  companies,
  onSelectCompanyById,
  onFocusCompanyOnMap,
  onLinkCompany,
  onUnlinkCompany,
}: SchedulesAgendaProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursorMonth, setCursorMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState(() => today);

  const fieldSchedules = useMemo(
    () => schedules.filter(isFieldAgendaSchedule),
    [schedules]
  );

  const companyOptions = useMemo(
    () =>
      [...companies]
        .sort((a, b) =>
          getCompanyDisplayName(a).localeCompare(getCompanyDisplayName(b), 'pt-BR')
        )
        .map((c) => ({
          value: c.id,
          label: getCompanyDisplayName(c),
          hint: c.city || undefined,
        })),
    [companies]
  );

  const countsByDay = useMemo(() => {
    const map = new Map<string, { total: number; visits: number }>();
    for (const item of fieldSchedules) {
      const day = scheduleDay(item);
      if (!day) continue;
      const key = dayKey(day);
      const current = map.get(key) || { total: 0, visits: 0 };
      current.total += 1;
      if (item.isVisit) current.visits += 1;
      map.set(key, current);
    }
    return map;
  }, [fieldSchedules]);

  const dayItems = useMemo(() => {
    return fieldSchedules
      .filter((item) => {
        const day = scheduleDay(item);
        return day ? sameDay(day, selectedDay) : false;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [fieldSchedules, selectedDay]);

  const dayVisits = dayItems.filter((i) => i.isVisit);
  const calendarCells = useMemo(() => buildMonthGrid(cursorMonth), [cursorMonth]);

  const goPrevMonth = () => {
    setCursorMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setCursorMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };
  const goToday = () => {
    setCursorMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-4 lg:gap-5 max-w-6xl">
      {/* Calendário */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base capitalize flex items-center gap-2">
                <CalendarDays className="size-4 text-primary shrink-0" />
                {formatMonthYear(cursorMonth)}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Toque em um dia para ver a agenda
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={goToday}>
                Hoje
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={goPrevMonth}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={goNextMonth}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground py-1"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarCells.map((cell) => {
              const key = dayKey(cell);
              const inMonth = cell.getMonth() === cursorMonth.getMonth();
              const isSelected = sameDay(cell, selectedDay);
              const isToday = sameDay(cell, today);
              const counts = countsByDay.get(key);
              const hasItems = (counts?.total ?? 0) > 0;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(startOfDay(cell))}
                  className={cn(
                    'relative aspect-square rounded-xl border text-sm font-semibold transition cursor-pointer flex flex-col items-center justify-center gap-1',
                    !inMonth && 'opacity-35',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                      : isToday
                        ? 'border-primary/50 bg-primary/5 text-foreground'
                        : 'bg-muted/30 border-border/60 text-foreground hover:bg-accent hover:border-border'
                  )}
                >
                  <span className="leading-none">{cell.getDate()}</span>
                  {hasItems && (
                    <span className="flex items-center gap-0.5">
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          isSelected
                            ? 'bg-primary-foreground'
                            : counts && counts.visits > 0
                              ? 'bg-visit'
                              : 'bg-primary'
                        )}
                      />
                      {(counts?.total ?? 0) > 1 && (
                        <span
                          className={cn(
                            'text-[9px] font-bold leading-none',
                            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          )}
                        >
                          {counts?.total}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-visit" />
              Dia com visita
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              Outro agendamento
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Agenda do dia */}
      <Card className="overflow-hidden flex flex-col min-h-[420px] xl:min-h-0">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                <Target className="size-4 text-primary shrink-0" />
                Agenda do dia
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1.5 capitalize">
                {formatDayLong(selectedDay)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Só itens com empresa selecionada (sem reuniões online)
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {dayItems.length} item(ns)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b bg-card">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border bg-muted/40 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Visitas
                </p>
                <p className="text-xl font-bold tabular-nums mt-0.5">{dayVisits.length}</p>
              </div>
              <div className="rounded-xl border bg-muted/40 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Total
                </p>
                <p className="text-xl font-bold tabular-nums mt-0.5">{dayItems.length}</p>
              </div>
            </div>
          </div>

          {dayItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2 border-dashed m-4 rounded-2xl border">
              <CalendarDays className="size-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhuma visita com empresa neste dia</p>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                Reuniões online ficam de fora. Só aparecem agendas com empresa selecionada no
                Estagius.
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1 max-h-[min(62vh,560px)]">
              <div className="p-3 sm:p-4 space-y-3">
                {dayItems.map((item) => (
                  <ScheduleCard
                    key={item.id}
                    item={item}
                    companyOptions={companyOptions}
                    onSelectCompanyById={onSelectCompanyById}
                    onFocusCompanyOnMap={onFocusCompanyOnMap}
                    onLinkCompany={onLinkCompany}
                    onUnlinkCompany={onUnlinkCompany}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Grade do mês começando na segunda-feira. */
function buildMonthGrid(monthStart: Date): Date[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // getDay(): 0=Dom ... 6=Sáb → converter para Seg=0
  const startOffset = (first.getDay() + 6) % 7;
  const cells: Date[] = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push(new Date(year, month, 1 - (startOffset - i)));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!;
    cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return cells;
}

function ScheduleCard({
  item,
  companyOptions,
  onSelectCompanyById,
  onFocusCompanyOnMap,
  onLinkCompany,
  onUnlinkCompany,
}: {
  item: ScheduleItem;
  companyOptions: Array<{ value: string; label: string; hint?: string }>;
  onSelectCompanyById: (companyId: string) => void;
  onFocusCompanyOnMap?: (companyId: string) => void;
  onLinkCompany?: (scheduleId: string, companyId: string) => void;
  onUnlinkCompany?: (scheduleId: string) => void;
}) {
  const unmatched = item.isVisit && !item.matchedCompanyId;
  const isManual = item.matchConfidence === 'manual';
  const time = formatTime(item.startsAt);
  const observations = (item.observations || item.description || '').trim();

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-3.5 space-y-3 shadow-sm',
        unmatched && 'border-amber-200/80 dark:border-amber-800/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-muted px-2.5 py-2 text-center min-w-14">
          <Clock className="size-3.5 mx-auto text-muted-foreground mb-1" />
          <p className="text-sm font-bold tabular-nums leading-none">{time || '—'}</p>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.isVisit ? (
              <Badge variant="warning">Visita</Badge>
            ) : (
              <Badge variant="secondary">{item.type || 'Agenda'}</Badge>
            )}
            <Badge variant="outline">{item.status}</Badge>
            {unmatched && (
              <Badge variant="outline" className="text-amber-700 border-amber-300">
                Sem match
              </Badge>
            )}
            {isManual && (
              <Badge variant="outline" className="text-teal-700 border-teal-300">
                Vínculo manual
              </Badge>
            )}
          </div>

          <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>

          {item.apiCompanyName &&
            item.apiCompanyName !== item.title &&
            item.apiCompanyName !== item.matchedCompanyName && (
              <p className="text-xs text-muted-foreground truncate">
                Empresa na agenda: {item.apiCompanyName}
              </p>
            )}

          {item.responsibleName && (
            <p className="text-xs text-muted-foreground">{item.responsibleName}</p>
          )}
        </div>
      </div>

      {observations && observations !== item.title && (
        <div className="rounded-xl border border-border/80 bg-muted/40 dark:bg-muted/25 p-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <StickyNote className="size-3.5 text-primary" />
            Observações
          </p>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {observations}
          </p>
        </div>
      )}

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        {item.matchedCompanyId ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectCompanyById(item.matchedCompanyId!)}
            >
              <Building2 />
              {item.matchedCompanyName || 'Empresa'}
            </Button>
            {onFocusCompanyOnMap && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFocusCompanyOnMap(item.matchedCompanyId!)}
              >
                <MapPin />
                Mapa
              </Button>
            )}
            {isManual && onUnlinkCompany && (
              <Button variant="ghost" size="sm" onClick={() => onUnlinkCompany(item.id)}>
                <Unlink />
                Desvincular
              </Button>
            )}
          </>
        ) : item.isVisit ? (
          <div className="w-full space-y-2">
            <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <AlertCircle className="size-3.5 shrink-0" />
              Sem empresa no mapa
              {item.extractedCompanyName ? ` (“${item.extractedCompanyName}”)` : ''}
            </p>
            {onLinkCompany && (
              <div className="flex flex-col gap-2">
                <SearchableSelect
                  value=""
                  options={companyOptions}
                  placeholder="Vincular empresa..."
                  searchPlaceholder="Buscar empresa..."
                  onChange={(companyId) => {
                    if (companyId) onLinkCompany(item.id, companyId);
                  }}
                />
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Link2 className="size-3" />
                  Só neste aparelho · {formatScheduleDate(item.startsAt)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Item de agenda (não é visita)</p>
        )}
      </div>
    </div>
  );
}
