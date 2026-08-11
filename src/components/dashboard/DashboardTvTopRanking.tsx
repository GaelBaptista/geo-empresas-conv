import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, ThumbsDown, Trophy, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  rankingsForPeriod,
  type DrvagasBundle,
  type HiringRankRow,
  type ReputationRankRow,
} from '@/services/drvagasApi';

const nf = new Intl.NumberFormat('pt-BR');

type RankMode = 'hired' | 'rejected' | 'noshow' | 'reputation';

const MODES: {
  id: RankMode;
  label: string;
  icon: typeof Trophy;
  accent: string;
  badge: string;
  value: string;
  dot: string;
}[] = [
  {
    id: 'hired',
    label: 'Mais contratam',
    icon: BriefcaseBusiness,
    accent: 'border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    value: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  {
    id: 'rejected',
    label: 'Mais reprovam',
    icon: ThumbsDown,
    accent: 'border-rose-200/70 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20',
    badge: 'border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
    value: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  {
    id: 'noshow',
    label: 'Mais faltas',
    icon: UserX,
    accent: 'border-amber-200/70 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20',
    badge: 'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
    value: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  {
    id: 'reputation',
    label: 'Melhor reputação',
    icon: Trophy,
    accent: 'border-sky-200/70 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20',
    badge: 'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
    value: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
];

function pctLabel(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

export function DashboardTvTopRanking({
  bundle,
  rotateMs = 20000,
  className,
}: {
  bundle: DrvagasBundle | null;
  rotateMs?: number;
  className?: string;
}) {
  const [mode, setMode] = useState<RankMode>('hired');
  const timerRef = useRef<number | null>(null);

  const slice = useMemo(
    () => (bundle ? rankingsForPeriod(bundle, 'month') : null),
    [bundle]
  );

  const next = useCallback(() => {
    setMode((m) => {
      const i = MODES.findIndex((x) => x.id === m);
      return MODES[(i + 1) % MODES.length].id;
    });
  }, []);

  const resetAuto = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(next, rotateMs);
  }, [next, rotateMs]);

  useEffect(() => {
    resetAuto();
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [resetAuto]);

  const goTo = (id: RankMode) => {
    setMode(id);
    resetAuto();
  };

  const meta = MODES.find((m) => m.id === mode)!;
  const Icon = meta.icon;

  const rows: Array<{
    key: string;
    name: string;
    value: string;
    sub?: string;
  }> = useMemo(() => {
    if (!slice) return [];

    if (mode === 'reputation') {
      return (slice.topReputation as ReputationRankRow[]).slice(0, 5).map((r, i) => ({
        key: r.groupKey,
        name: r.companyName,
        value: pctLabel(r.reputation.hireRate),
        sub: r.reputation.label,
      }));
    }

    const list: HiringRankRow[] =
      mode === 'hired'
        ? slice.topHired
        : mode === 'rejected'
          ? slice.topRejecters
          : slice.topNoShows;

    return list.slice(0, 5).map((r, i) => ({
      key: r.groupKey,
      name: r.companyName,
      value: nf.format(r.count),
      sub: `Posição #${i + 1}`,
    }));
  }, [slice, mode]);

  return (
    <Card className={cn('min-h-0 overflow-hidden', meta.accent, className)}>
      <CardHeader className="space-y-2 border-b border-border/50 py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span
              className={cn(
                'rounded-lg p-1.5',
                mode === 'hired' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                mode === 'rejected' && 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
                mode === 'noshow' && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                mode === 'reputation' && 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
              )}
            >
              <Icon className="size-4" />
            </span>
            Ranking do mês
          </CardTitle>
          <Badge variant="outline" className={cn('text-[10px]', meta.badge)}>
            Top 5
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{meta.label}</p>
          <div className="flex items-center gap-1.5">
            {MODES.map((m) => (
              <Button
                key={m.id}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={m.label}
                onClick={() => goTo(m.id)}
                className="size-5 rounded-full p-0"
              >
                <span
                  className={cn(
                    'block size-2.5 rounded-full transition-colors',
                    mode === m.id ? m.dot : 'bg-muted-foreground/35'
                  )}
                />
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 p-3">
        {!bundle ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Carregando ranking…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sem dados no mês
          </p>
        ) : (
          rows.map((row, index) => (
            <div
              key={row.key}
              className="flex items-center gap-3 rounded-xl border bg-background/80 px-3 py-2.5 shadow-sm"
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  index === 0 &&
                    'bg-amber-100 text-amber-800 ring-1 ring-amber-300/60 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-700/50',
                  index === 1 &&
                    'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
                  index === 2 &&
                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                  index > 2 && 'bg-muted text-muted-foreground'
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{row.name}</p>
                {row.sub && (
                  <p className="truncate text-[11px] text-muted-foreground">{row.sub}</p>
                )}
              </div>
              <span className={cn('shrink-0 text-lg font-bold tabular-nums', meta.value)}>
                {row.value}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
