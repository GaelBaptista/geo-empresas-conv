import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Calendar,
  ChevronRight,
  Clock,
  StickyNote,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isUpcomingSchedule } from '@/lib/schedule-match';
import type { ScheduleItem } from '@/types';

type YearFilter = 'all' | number;

function yearOf(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
}

/** Data curta sem truncar: "06 ago · 09:00" */
function formatCompact(iso: string): { day: string; month: string; time: string; full: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { day: '—', month: '', time: '', full: '—' };
  }
  return {
    day: d.toLocaleDateString('pt-BR', { day: '2-digit' }),
    month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    full: d.toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('cancel')) {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800';
  }
  if (s.includes('conclu') || s.includes('done') || s.includes('complet')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800';
  }
  if (s.includes('reagend')) {
    return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800';
  }
  return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800';
}

function noteText(item: ScheduleItem): string {
  const raw = (item.observations || item.description || '').trim();
  if (!raw || raw === item.title.trim()) return '';
  return raw;
}

/** Evita título todo CAPS na UI. */
function displayTitle(title: string): string {
  const t = title.trim();
  if (t.length > 3 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÃÕÊ]/.test(t)) {
    return t.charAt(0) + t.slice(1).toLowerCase();
  }
  return t;
}

export function CompanyVisitHistory({
  schedules,
  companyId,
}: {
  schedules: ScheduleItem[];
  companyId: string;
}) {
  const all = useMemo(
    () =>
      schedules
        .filter((s) => s.isVisit && s.matchedCompanyId === companyId)
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    [schedules, companyId]
  );

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const item of all) {
      const y = yearOf(item.startsAt);
      if (y != null) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [all]);

  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  const [selected, setSelected] = useState<ScheduleItem | null>(null);

  useEffect(() => {
    setYearFilter('all');
    setSelected(null);
  }, [companyId]);

  useEffect(() => {
    if (yearFilter === 'all') return;
    if (!years.includes(yearFilter)) setYearFilter('all');
  }, [years, yearFilter]);

  const filtered = useMemo(() => {
    if (yearFilter === 'all') return all;
    return all.filter((item) => yearOf(item.startsAt) === yearFilter);
  }, [all, yearFilter]);

  const upcoming = useMemo(
    () =>
      filtered
        .filter((item) => isUpcomingSchedule(item))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [filtered]
  );

  const past = useMemo(
    () => filtered.filter((item) => !isUpcomingSchedule(item)),
    [filtered]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Visitas</h3>
          <p className="text-[12px] text-muted-foreground">
            {all.length === 0
              ? 'Nenhum registro na agenda'
              : `${all.length} registro${all.length === 1 ? '' : 's'}${
                  upcoming.length
                    ? ` · ${upcoming.length} próxima${upcoming.length > 1 ? 's' : ''}`
                    : ''
                }`}
          </p>
        </div>
      </div>

      {years.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <FilterPill
            active={yearFilter === 'all'}
            onClick={() => setYearFilter('all')}
            label="Todos"
          />
          {years.map((y) => (
            <FilterPill
              key={y}
              active={yearFilter === y}
              onClick={() => setYearFilter(y)}
              label={String(y)}
            />
          ))}
        </div>
      )}

      {all.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
          Nada neste ano
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <ListSection title="Próximas" count={upcoming.length}>
              {upcoming.map((item) => (
                <VisitRow
                  key={item.id}
                  item={item}
                  upcoming
                  onOpen={() => setSelected(item)}
                />
              ))}
            </ListSection>
          )}
          {past.length > 0 && (
            <ListSection title="Histórico" count={past.length}>
              {past.map((item) => (
                <VisitRow key={item.id} item={item} onOpen={() => setSelected(item)} />
              ))}
            </ListSection>
          )}
        </div>
      )}

      <VisitDetailDialog
        item={selected}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      {label}
    </button>
  );
}

function ListSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground/70">{count}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <ul className="space-y-2 list-none p-0 m-0">{children}</ul>
    </section>
  );
}

function VisitRow({
  item,
  upcoming = false,
  onOpen,
}: {
  item: ScheduleItem;
  upcoming?: boolean;
  onOpen: () => void;
}) {
  const { day, month, time } = formatCompact(item.startsAt);
  const hasNote = Boolean(noteText(item));
  const title = displayTitle(item.title);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'w-full text-left group rounded-xl border transition-all cursor-pointer',
          'flex items-stretch gap-0 overflow-hidden',
          'hover:shadow-md hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          upcoming
            ? 'border-primary/25 bg-card shadow-sm'
            : 'border-border/80 bg-card hover:bg-muted/20'
        )}
      >
        {/* Bloco data — próximo = verde com texto branco */}
        <div
          className={cn(
            'shrink-0 w-[4.25rem] flex flex-col items-center justify-center px-1.5 py-2.5 text-center',
            upcoming
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/70 text-muted-foreground border-r border-border/60'
          )}
        >
          <span className="text-base font-bold tabular-nums leading-none tracking-tight">
            {day}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase leading-none mt-1',
              upcoming ? 'text-primary-foreground/85' : 'opacity-80'
            )}
          >
            {month}
          </span>
          <span
            className={cn(
              'text-[11px] font-semibold tabular-nums leading-none mt-1.5',
              upcoming ? 'text-primary-foreground' : 'text-foreground/80'
            )}
          >
            {time || '—'}
          </span>
        </div>

        <div className="min-w-0 flex-1 px-3 py-2.5 flex items-center gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
              {title}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize',
                  upcoming
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {item.status}
              </span>
              {item.responsibleName ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground min-w-0 max-w-full">
                  <User className="size-3 shrink-0 opacity-60" />
                  <span className="truncate">{item.responsibleName}</span>
                </span>
              ) : null}
              {hasNote ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                  <StickyNote className="size-3" />
                  Obs.
                </span>
              ) : null}
            </div>
          </div>
          <ChevronRight
            className={cn(
              'size-4 shrink-0 transition-transform group-hover:translate-x-0.5',
              upcoming ? 'text-primary/60' : 'text-muted-foreground/40'
            )}
          />
        </div>
      </button>
    </li>
  );
}

function VisitDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ScheduleItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const compact = item ? formatCompact(item.startsAt) : null;
  const notes = item ? noteText(item) : '';
  const upcoming = item ? isUpcomingSchedule(item) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        {item && compact ? (
          <>
            <div
              className={cn(
                'px-5 pt-5 pb-4 text-left',
                upcoming
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 border-b'
              )}
            >
              <div className="flex flex-wrap gap-1.5 mb-3">
                {upcoming ? (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    Próxima visita
                  </span>
                ) : (
                  <span className="rounded-full bg-background border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Histórico
                  </span>
                )}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
                    upcoming
                      ? 'bg-white/15 text-primary-foreground'
                      : statusTone(item.status)
                  )}
                >
                  {item.status}
                </span>
              </div>
              <DialogHeader className="p-0 space-y-1">
                <DialogTitle
                  className={cn(
                    'text-base leading-snug pr-6 font-semibold',
                    upcoming ? 'text-primary-foreground' : 'text-foreground'
                  )}
                >
                  {displayTitle(item.title)}
                </DialogTitle>
                <DialogDescription
                  className={cn(
                    'text-sm',
                    upcoming ? 'text-primary-foreground/85' : 'text-muted-foreground'
                  )}
                >
                  {compact.full}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-5 py-4 space-y-4">
              {item.responsibleName ? (
                <DetailRow
                  icon={<User className="size-4" />}
                  label="Responsável"
                  value={item.responsibleName}
                />
              ) : (
                <DetailRow
                  icon={<Clock className="size-4" />}
                  label="Horário"
                  value={`${compact.day} ${compact.month} · ${compact.time}`}
                />
              )}

              {notes ? (
                <div className="rounded-xl border bg-muted/25 p-3.5 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <StickyNote className="size-3.5 text-primary" />
                    Observações da agenda
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {notes}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sem observações registradas.</p>
              )}
            </div>

            <div className="px-5 pb-5">
              <Button
                type="button"
                variant={upcoming ? 'default' : 'outline'}
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="size-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium leading-snug break-words">{value}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed py-10 px-4 text-center">
      <div className="size-10 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
        <Calendar className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Sem visitas nesta empresa</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[14rem] mx-auto leading-relaxed">
        Quando a agenda Estagius tiver visitas vinculadas, elas entram aqui.
      </p>
    </div>
  );
}
