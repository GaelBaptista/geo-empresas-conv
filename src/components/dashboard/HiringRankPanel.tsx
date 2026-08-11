import { useEffect, useMemo, useState } from 'react';
import {
  ThumbsDown,
  BriefcaseBusiness,
  Building2,
  Sparkles,
  UserX,
  MapPin,
  Search,
  RefreshCw,
  Users,
  ChevronRight,
  CalendarRange,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RankingExportMenu } from '@/components/dashboard/RankingExportMenu';
import type { RankingExportRow } from '@/lib/ranking-export';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatSyncAgo } from '@/lib/format-relative';
import {
  formatRecruitersLabel,
  listRankingPeriodOptions,
  periodKey,
  rankingsForSelection,
  reputationTone,
  type GroupMemberRef,
  type HiringPeriodSelection,
  type HiringRankRow,
  type DrvagasBundle,
  type ReputationLabel,
  type ReputationRankRow,
} from '@/services/drvagasApi';
import type { Company } from '@/types';

type RankView = 'reputation' | 'hired' | 'rejected' | 'noshow';

const PAGE_SIZE = 12;

function formatCnpj(digits: string): string {
  if (digits.length !== 14) return digits;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function pctLabel(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesRankSearch(
  query: string,
  name: string,
  members: GroupMemberRef[],
  cnpjDigits?: string
): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;

  const digitQuery = query.replace(/\D/g, '');
  const searchByCnpj = digitQuery.length >= 3;

  if (normalizeSearch(name).includes(q)) return true;
  if (searchByCnpj && cnpjDigits?.includes(digitQuery)) return true;

  return members.some((member) => {
    if (normalizeSearch(member.companyName).includes(q)) return true;
    if (searchByCnpj && member.cnpjDigits.includes(digitQuery)) return true;
    return false;
  });
}

function buildPageItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push('ellipsis');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push('ellipsis');
  items.push(total);
  return items;
}

function stripeForLabel(label: ReputationLabel): string {
  switch (label) {
    case 'Excelente':
      return 'bg-emerald-500';
    case 'Boa':
      return 'bg-teal-500';
    case 'Regular':
      return 'bg-amber-400';
    case 'Atenção':
      return 'bg-orange-500';
    case 'Crítica':
      return 'bg-rose-500';
    default:
      return 'bg-muted-foreground/40';
  }
}

function openMemberFicha(
  member: GroupMemberRef,
  companies: Company[],
  onSelectCompany: (company: Company) => void
) {
  if (!member.companyId) return;
  const company = companies.find((c) => c.id === member.companyId);
  if (company) onSelectCompany(company);
}

interface HiringRankPanelProps {
  bundle: DrvagasBundle;
  companies: Company[];
  onSelectCompany: (company: Company) => void;
  compact?: boolean;
  className?: string;
}

export function HiringRankPanel({
  bundle,
  companies,
  onSelectCompany,
  className,
}: HiringRankPanelProps) {
  const periodOptions = useMemo(() => listRankingPeriodOptions(), []);
  const [periodSelection, setPeriodSelection] = useState<HiringPeriodSelection>(
    () => periodOptions[0]?.selection ?? { type: 'all' }
  );
  const [view, setView] = useState<RankView>('reputation');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [unitsContext, setUnitsContext] = useState<{
    name: string;
    members: GroupMemberRef[];
    mode: 'reputation' | 'volume';
    volumeAccent?: 'hired' | 'rejected' | 'noshow';
  } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const syncLabel = formatSyncAgo(bundle.totals.freezeLastSyncAt, nowTick);

  const periodData = useMemo(
    () => rankingsForSelection(bundle, companies, periodSelection),
    [bundle, companies, periodSelection]
  );
  const { topRejecters, topHired, topNoShows, topReputation, totals } = periodData;

  useEffect(() => {
    setPage(1);
  }, [periodSelection, view, search]);

  const filteredReputation = useMemo(
    () =>
      topReputation.filter((row) =>
        matchesRankSearch(search, row.companyName, row.members, row.cnpjDigits)
      ),
    [topReputation, search]
  );

  const filteredVolume = useMemo(() => {
    const source =
      view === 'hired' ? topHired : view === 'rejected' ? topRejecters : topNoShows;
    return source.filter((row) =>
      matchesRankSearch(search, row.companyName, row.members, row.cnpjDigits)
    );
  }, [view, topHired, topRejecters, topNoShows, search]);

  const filteredCount =
    view === 'reputation' ? filteredReputation.length : filteredVolume.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;

  const pagedReputation = useMemo(
    () => filteredReputation.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredReputation, pageStart]
  );
  const pagedVolume = useMemo(
    () => filteredVolume.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredVolume, pageStart]
  );

  const exportRows = useMemo((): RankingExportRow[] => {
    if (view === 'reputation') {
      return filteredReputation.map((row, index) => {
        const r = row.reputation;
        return {
          rank: index + 1,
          empresa: row.companyName,
          recrutador: row.recruiters.join(' · '),
          aproveitamento: pctLabel(r.utilizationRate),
          perda: pctLabel(r.discardRate),
          classificacao: r.label,
          enviados: r.enviados,
          contratados: r.contratados,
          reprovados: r.reprovados,
          faltas: r.naoCompareceu,
          entrevista: r.emFunil,
          unidades: row.memberCount,
          volume: '',
        };
      });
    }
    return filteredVolume.map((row, index) => ({
      rank: index + 1,
      empresa: row.companyName,
      recrutador: row.recruiters.join(' · '),
      aproveitamento: '',
      perda: '',
      classificacao: '',
      enviados: '',
      contratados: '',
      reprovados: '',
      faltas: '',
      entrevista: '',
      unidades: row.memberCount,
      volume: row.count,
    }));
  }, [view, filteredReputation, filteredVolume]);

  const activePeriodKey = periodKey(periodSelection);
  const activePeriodLabel =
    periodOptions.find((o) => o.key === activePeriodKey)?.label ?? 'Geral';

  const openUnits = (
    name: string,
    members: GroupMemberRef[],
    mode: 'reputation' | 'volume',
    volumeAccent?: 'hired' | 'rejected' | 'noshow'
  ) => {
    setUnitsContext({ name, members, mode, volumeAccent });
    setUnitsOpen(true);
  };

  const views: {
    id: RankView;
    label: string;
    short: string;
    icon: typeof Sparkles;
  }[] = [
    { id: 'reputation', label: 'Reputação', short: 'Aproveitamento', icon: Sparkles },
    { id: 'hired', label: 'Contratados', short: 'Volume', icon: BriefcaseBusiness },
    { id: 'rejected', label: 'Reprovados', short: 'Volume', icon: ThumbsDown },
    { id: 'noshow', label: 'Faltas', short: 'Volume', icon: UserX },
  ];

  const listEyebrow =
    view === 'reputation'
      ? 'Ordenado por taxa de aproveitamento · mínimo 5 enviados'
      : view === 'hired'
        ? 'Ordenado por volume de contratações'
        : view === 'rejected'
          ? 'Ordenado por volume de reprovações'
          : 'Ordenado por volume de faltas';

  const kpis = [
    {
      label: 'Candidatos',
      value: totals.enviados,
      tone: 'border-l-foreground/25',
      hint: 'Enviados no período (inclui em entrevista)',
    },
    {
      label: 'Contratados',
      value: totals.contratados,
      tone: 'border-l-sky-500',
      hint: 'Contratações no período',
    },
    {
      label: 'Reprovados',
      value: totals.reprovados,
      tone: 'border-l-rose-500',
      hint: 'Reprovações no período',
    },
    {
      label: 'Faltas',
      value: totals.naoCompareceu,
      tone: 'border-l-amber-500',
      hint: 'Não comparecimentos no período',
    },
  ] as const;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('space-y-0 overflow-hidden rounded-2xl border bg-card shadow-sm', className)}>
        {/* Hero / controles */}
        <div className="relative overflow-hidden border-b bg-gradient-to-br from-teal-50/90 via-card to-sky-50/40 dark:from-teal-950/40 dark:via-card dark:to-sky-950/20">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 12% 20%, oklch(0.72 0.08 185 / 0.35), transparent 42%), radial-gradient(circle at 88% 0%, oklch(0.78 0.06 230 / 0.3), transparent 38%)',
            }}
          />
          <div className="relative space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800/70 dark:text-teal-200/70">
                  Desempenho comercial
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
                  <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Building2 className="size-4" />
                  </span>
                  Ranking das empresas
                </h2>
                <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
                  Cada posição é um <span className="text-foreground font-medium">grupo</span> (soma
                  dos CNPJs). Toque em qualquer linha para ver as unidades.
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="gap-1.5 self-start sm:self-auto bg-background/70 backdrop-blur-sm font-medium text-muted-foreground"
                  >
                    <RefreshCw className="size-3" />
                    {syncLabel}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Última atualização
                  {bundle.totals.freezeLastSyncAt
                    ? ` · ${new Date(bundle.totals.freezeLastSyncAt).toLocaleString('pt-BR')}`
                    : ''}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarRange className="size-3.5" />
                Período
                <span className="font-normal normal-case tracking-normal text-muted-foreground/80">
                  · Geral desde ago/2026 (acumulado)
                </span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-thin">
                {periodOptions.map((opt) => {
                  const active = activePeriodKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPeriodSelection(opt.selection)}
                      className={cn(
                        'shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-all cursor-pointer',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'bg-foreground text-background shadow-md'
                          : 'bg-background/80 text-muted-foreground border border-border/70 hover:text-foreground hover:border-foreground/20'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* KPIs compactos */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border-b divide-x divide-y lg:divide-y-0 bg-muted/20">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className={cn('border-l-4 px-4 py-3.5 sm:px-5', kpi.tone)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground cursor-help">
                    {kpi.label}
                  </p>
                </TooltipTrigger>
                <TooltipContent>{kpi.hint}</TooltipContent>
              </Tooltip>
              <p className="mt-1 text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight">
                {kpi.value.toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </div>

        {/* Abas de ranking + busca */}
        <div className="border-b bg-card px-4 py-4 sm:px-5 space-y-4">
          <div
            role="tablist"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl bg-muted/70 p-1"
          >
            {views.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(item.id)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-semibold transition-all cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('size-3.5 shrink-0', active && 'text-primary')} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {views.find((v) => v.id === view)?.label} · {activePeriodLabel}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{listEyebrow}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
              <div className="flex items-center gap-2 flex-1 sm:max-w-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar grupo, unidade ou CNPJ…"
                    className="pl-9 bg-background h-10"
                  />
                </div>
                <Badge variant="secondary" className="shrink-0 tabular-nums h-10 px-3 text-xs">
                  {filteredCount.toLocaleString('pt-BR')}
                </Badge>
              </div>
              <RankingExportMenu
                mode={view === 'reputation' ? 'reputation' : 'volume'}
                periodLabel={activePeriodLabel}
                viewLabel={views.find((v) => v.id === view)?.label ?? view}
                rows={exportRows}
              />
            </div>
          </div>

          {view === 'reputation' ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed rounded-lg bg-muted/50 px-3 py-2">
              <span className="font-semibold text-foreground">Aproveitamento</span> (principal) =
              contratados ÷ enviados — quanto a empresa realmente aproveitou.{' '}
              <span className="font-semibold text-foreground">Perda</span> (sutil) = (reprovados +
              faltas) ÷ enviados. Entrevista ainda aberta não entra nas taxas. Só grupos com{' '}
              <strong>5+ enviados</strong>.
            </p>
          ) : null}
        </div>

        {/* Leaderboard */}
        <div className="bg-muted/15 p-3 sm:p-4">
          {view === 'reputation' ? (
            <ReputationBoard
              rows={pagedReputation}
              startRank={pageStart}
              onOpenUnits={(name, members) => openUnits(name, members, 'reputation')}
            />
          ) : (
            <VolumeBoard
              rows={pagedVolume}
              startRank={pageStart}
              maxCount={Math.max(1, ...filteredVolume.map((r) => r.count), 1)}
              accent={view === 'hired' ? 'hired' : view === 'rejected' ? 'rejected' : 'noshow'}
              empty={
                search.trim()
                  ? 'Nenhum grupo encontrado com essa busca.'
                  : view === 'hired'
                    ? 'Nenhuma contratação neste período.'
                    : view === 'rejected'
                      ? 'Nenhuma reprovação neste período.'
                      : 'Nenhuma falta neste período.'
              }
              onOpenUnits={(name, members) =>
                openUnits(
                  name,
                  members,
                  'volume',
                  view === 'hired' ? 'hired' : view === 'rejected' ? 'rejected' : 'noshow'
                )
              }
            />
          )}

          {filteredCount > PAGE_SIZE ? (
            <div className="pt-4">
              <RankPagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          ) : null}
        </div>

        <GroupUnitsSheet
          open={unitsOpen}
          onOpenChange={setUnitsOpen}
          context={unitsContext}
          companies={companies}
          onSelectCompany={(company) => {
            setUnitsOpen(false);
            onSelectCompany(company);
          }}
        />
      </div>
    </TooltipProvider>
  );
}

function RankPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const items = buildPageItems(page, totalPages);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          />
        </PaginationItem>
        {items.map((item, idx) =>
          item === 'ellipsis' ? (
            <PaginationItem key={`e-${idx}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink isActive={item === page} onClick={() => onPageChange(item)}>
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function OutcomeBar({
  hire,
  reject,
  noShow,
  className,
}: {
  hire: number;
  reject: number;
  noShow: number;
  className?: string;
}) {
  return (
    <div
      className={cn('h-1.5 rounded-full bg-muted overflow-hidden flex min-w-[5rem]', className)}
    >
      <div className="h-full bg-sky-500" style={{ width: `${hire}%` }} />
      <div className="h-full bg-rose-500" style={{ width: `${reject}%` }} />
      <div className="h-full bg-amber-500" style={{ width: `${noShow}%` }} />
    </div>
  );
}

function ResultChips({
  enviados,
  contratados,
  reprovados,
  naoCompareceu,
  emFunil = 0,
  compact = false,
}: {
  enviados?: number;
  contratados: number;
  reprovados: number;
  naoCompareceu: number;
  emFunil?: number;
  compact?: boolean;
}) {
  const pad = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <div className="flex flex-wrap gap-1">
      {enviados != null ? (
        <span className={cn('rounded-md font-medium tabular-nums bg-muted text-foreground', pad)}>
          {enviados} env.
        </span>
      ) : null}
      <span
        className={cn(
          'rounded-md font-medium tabular-nums bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
          pad
        )}
      >
        {contratados} contr.
      </span>
      <span
        className={cn(
          'rounded-md font-medium tabular-nums bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
          pad
        )}
      >
        {reprovados} repr.
      </span>
      <span
        className={cn(
          'rounded-md font-medium tabular-nums bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
          pad
        )}
      >
        {naoCompareceu} falta{naoCompareceu === 1 ? '' : 's'}
      </span>
      {emFunil > 0 ? (
        <span
          className={cn(
            'rounded-md font-medium tabular-nums bg-muted text-muted-foreground',
            pad
          )}
        >
          {emFunil} entr.
        </span>
      ) : null}
    </div>
  );
}

function RecruiterChip({ names, className }: { names: string[]; className?: string }) {
  if (names.length === 0) return null;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-lg border border-teal-300/80 bg-teal-50 px-2.5 py-1',
        'text-xs font-semibold text-teal-900 dark:border-teal-700/70 dark:bg-teal-950/55 dark:text-teal-100',
        className
      )}
    >
      <UserRound className="size-3.5 shrink-0" />
      <span className="truncate">{formatRecruitersLabel(names)}</span>
    </span>
  );
}

function RankIndex({ rank }: { rank: number }) {
  const podium = rank <= 3;
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums',
        podium
          ? 'bg-foreground text-background shadow-sm'
          : 'bg-muted/80 text-muted-foreground'
      )}
    >
      {rank}
    </span>
  );
}

function ReputationBoard({
  rows,
  startRank = 0,
  onOpenUnits,
}: {
  rows: ReputationRankRow[];
  startRank?: number;
  onOpenUnits: (name: string, members: GroupMemberRef[]) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState message="Nenhum grupo encontrado. Ajuste a busca ou o período." />
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row, index) => {
        const r = row.reputation;
        const rank = startRank + index + 1;
        const hirePct = Math.round((r.hireRate ?? 0) * 100);
        const rejectPct = Math.round((r.rejectRate ?? 0) * 100);
        const noShowPct = Math.round((r.noShowRate ?? 0) * 100);

        return (
          <li key={row.groupKey}>
            <button
              type="button"
              onClick={() => onOpenUnits(row.companyName, row.members)}
              className={cn(
                'group relative flex w-full overflow-hidden rounded-xl border bg-card text-left transition-all cursor-pointer',
                'hover:border-primary/40 hover:shadow-md hover:bg-accent/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <span
                className={cn('absolute inset-y-0 left-0 w-1', stripeForLabel(r.label))}
                aria-hidden
              />
              <div className="flex w-full flex-col gap-3 p-3.5 pl-4 sm:flex-row sm:items-center sm:gap-4 sm:p-4 sm:pl-5">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <RankIndex rank={rank} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                        {row.companyName}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn('font-semibold text-[10px]', reputationTone(r.label))}
                      >
                        {r.label}
                      </Badge>
                    </div>
                    <RecruiterChip names={row.recruiters} />
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Users className="size-3 shrink-0" />
                      {row.memberCount > 1
                        ? `${row.memberCount} unidades · clique para abrir`
                        : `1 unidade${row.onMap ? '' : ' · fora do mapa'} · clique para abrir`}
                    </p>
                    <div className="pt-0.5 space-y-1.5 max-w-md">
                      {r.enviados > 0 ? (
                        <OutcomeBar hire={hirePct} reject={rejectPct} noShow={noShowPct} />
                      ) : null}
                      <ResultChips
                        enviados={r.enviados}
                        contratados={r.contratados}
                        reprovados={r.reprovados}
                        naoCompareceu={r.naoCompareceu}
                        emFunil={r.emFunil}
                        compact
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-5 pl-12 sm:pl-0">
                  <div className="text-left sm:text-right">
                    <p className="text-3xl font-semibold tabular-nums tracking-tight text-primary leading-none">
                      {pctLabel(r.utilizationRate)}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      aproveitamento
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      perda{' '}
                      <span className="font-semibold tabular-nums text-foreground/75">
                        {pctLabel(r.discardRate)}
                      </span>
                      {r.emFunil > 0 ? (
                        <>
                          {' '}
                          ·{' '}
                          <span className="tabular-nums text-foreground/70">{r.emFunil}</span> em
                          entrevista
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground transition-all group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
                    <ChevronRight className="size-4" />
                  </span>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function VolumeBoard({
  rows,
  startRank = 0,
  maxCount,
  accent,
  empty,
  onOpenUnits,
}: {
  rows: HiringRankRow[];
  startRank?: number;
  maxCount?: number;
  accent: 'hired' | 'rejected' | 'noshow';
  empty: string;
  onOpenUnits: (name: string, members: GroupMemberRef[]) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState message={empty} />;
  }

  const maxValue = Math.max(1, maxCount ?? 0, ...rows.map((r) => r.count));
  const bar =
    accent === 'hired'
      ? 'bg-sky-500'
      : accent === 'rejected'
        ? 'bg-rose-500'
        : 'bg-amber-500';
  const num =
    accent === 'hired'
      ? 'text-sky-700 dark:text-sky-300'
      : accent === 'rejected'
        ? 'text-rose-700 dark:text-rose-300'
        : 'text-amber-700 dark:text-amber-300';
  const stripe =
    accent === 'hired'
      ? 'bg-sky-500'
      : accent === 'rejected'
        ? 'bg-rose-500'
        : 'bg-amber-500';
  const valueLabel =
    accent === 'hired' ? 'contratados' : accent === 'rejected' ? 'reprovados' : 'faltas';

  return (
    <ul className="space-y-2">
      {rows.map((row, index) => {
        const rank = startRank + index + 1;
        const barPct = Math.round((row.count / maxValue) * 100);

        return (
          <li key={row.groupKey}>
            <button
              type="button"
              onClick={() => onOpenUnits(row.companyName, row.members)}
              className={cn(
                'group relative flex w-full overflow-hidden rounded-xl border bg-card text-left transition-all cursor-pointer',
                'hover:border-primary/40 hover:shadow-md hover:bg-accent/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <span className={cn('absolute inset-y-0 left-0 w-1', stripe)} aria-hidden />
              <div className="flex w-full items-center gap-3 p-3.5 pl-4 sm:gap-4 sm:p-4 sm:pl-5">
                <RankIndex rank={rank} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="font-semibold leading-snug group-hover:text-primary transition-colors">
                      {row.companyName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.memberCount > 1
                        ? `${row.memberCount} unidades`
                        : `1 unidade${row.onMap ? '' : ' · fora do mapa'}`}
                    </p>
                  </div>
                  <RecruiterChip names={row.recruiters} />
                  <div className="h-2 max-w-md rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', bar)}
                      style={{ width: `${Math.max(barPct, row.count > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn('text-2xl sm:text-3xl font-semibold tabular-nums leading-none', num)}>
                    {row.count.toLocaleString('pt-BR')}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {valueLabel}
                  </p>
                </div>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground transition-all group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
                  <ChevronRight className="size-4" />
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/60 px-4 py-16 text-center">
      <Building2 className="mx-auto size-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function GroupUnitsSheet({
  open,
  onOpenChange,
  context,
  companies,
  onSelectCompany,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: {
    name: string;
    members: GroupMemberRef[];
    mode: 'reputation' | 'volume';
    volumeAccent?: 'hired' | 'rejected' | 'noshow';
  } | null;
  companies: Company[];
  onSelectCompany: (company: Company) => void;
}) {
  const members = context?.members ?? [];
  const mode = context?.mode ?? 'reputation';
  const volumeAccent = context?.volumeAccent;
  const volumeLabel =
    volumeAccent === 'hired'
      ? 'contratados'
      : volumeAccent === 'rejected'
        ? 'reprovados'
        : volumeAccent === 'noshow'
          ? 'faltas'
          : 'casos';
  const [unitSearch, setUnitSearch] = useState('');

  useEffect(() => {
    if (open) setUnitSearch('');
  }, [open, context?.name]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(unitSearch);
    const digits = unitSearch.replace(/\D/g, '');
    if (!q && digits.length < 3) return members;
    return members.filter((m) => {
      if (normalizeSearch(m.companyName).includes(q)) return true;
      if (digits.length >= 3 && m.cnpjDigits.includes(digits)) return true;
      return false;
    });
  }, [members, unitSearch]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b bg-gradient-to-br from-teal-50/80 via-card to-card dark:from-teal-950/30 px-5 py-5 pr-12">
          <SheetHeader className="space-y-1.5 text-left p-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-800/70 dark:text-teal-200/70">
              Unidades do grupo
            </p>
            <SheetTitle className="text-xl leading-snug pr-2">
              {context?.name || 'Grupo'}
            </SheetTitle>
            <SheetDescription className="text-xs leading-relaxed">
              {members.length} unidade{members.length === 1 ? '' : 's'} no período selecionado.
              Toque numa unidade para abrir a ficha no mapa.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="shrink-0 border-b px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              placeholder="Filtrar unidade ou CNPJ…"
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-3 py-3 space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-10 text-center">
                Nenhuma unidade encontrada.
              </p>
            ) : (
              filtered.map((member) => {
                const canOpen = Boolean(member.onMap && member.companyId);
                const decididos =
                  member.contratados + member.reprovados + member.naoCompareceu;
                const hasMetrics =
                  decididos > 0 || member.emFunil > 0 || member.volumeCount > 0;

                return (
                  <button
                    key={member.cnpjDigits}
                    type="button"
                    disabled={!canOpen}
                    onClick={() => {
                      if (canOpen) openMemberFicha(member, companies, onSelectCompany);
                    }}
                    className={cn(
                      'group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition',
                      canOpen
                        ? 'hover:border-primary/40 hover:bg-accent/40 cursor-pointer'
                        : 'opacity-55 cursor-not-allowed'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                        canOpen ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <MapPin className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug">{member.companyName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            CNPJ {formatCnpj(member.cnpjDigits)}
                            {member.onMap ? '' : ' · fora do mapa'}
                          </p>
                          <div className="pt-1">
                            <RecruiterChip names={member.recruiters} />
                          </div>
                        </div>
                          {mode === 'reputation' && member.utilizationRate != null ? (
                            <div className="shrink-0 text-right">
                              <p className="text-lg font-semibold tabular-nums text-primary leading-none">
                                {pctLabel(member.utilizationRate)}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                aproveit.
                                {member.discardRate != null
                                  ? ` · perda ${pctLabel(member.discardRate)}`
                                  : ''}
                              </p>
                            </div>
                          ) : null}
                        {mode === 'volume' && member.volumeCount > 0 ? (
                          <div className="shrink-0 text-right">
                            <p
                              className={cn(
                                'text-lg font-semibold tabular-nums leading-none',
                                volumeAccent === 'hired' && 'text-sky-700 dark:text-sky-300',
                                volumeAccent === 'rejected' && 'text-rose-700 dark:text-rose-300',
                                volumeAccent === 'noshow' && 'text-amber-700 dark:text-amber-300'
                              )}
                            >
                              {member.volumeCount}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {volumeLabel}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      {hasMetrics ? (
                        <ResultChips
                          enviados={decididos + member.emFunil}
                          contratados={member.contratados}
                          reprovados={member.reprovados}
                          naoCompareceu={member.naoCompareceu}
                          emFunil={member.emFunil}
                          compact
                        />
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Sem resultado neste período
                        </p>
                      )}
                      {canOpen ? (
                        <p className="text-[11px] font-medium text-primary inline-flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          Abrir ficha no mapa
                          <ChevronRight className="size-3" />
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <Separator />
        <p className="shrink-0 px-5 py-3 text-[11px] text-muted-foreground leading-relaxed">
          Números abaixo são só daquele CNPJ. O selo do grupo no ranking usa a soma de todas as
          unidades.
        </p>
      </SheetContent>
    </Sheet>
  );
}
