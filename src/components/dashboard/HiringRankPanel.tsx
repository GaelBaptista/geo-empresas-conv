import { useEffect, useMemo, useState } from 'react';
import {
  ThumbsDown,
  BriefcaseBusiness,
  Building2,
  Sparkles,
  UserX,
  Info,
  CircleHelp,
  ChevronDown,
  MapPin,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatSyncAgo } from '@/lib/format-relative';
import {
  rankingsForPeriod,
  reputationCriteria,
  reputationTone,
  type GroupMemberRef,
  type HiringPeriod,
  type HiringRankRow,
  type MinivagasBundle,
  type ReputationRankRow,
} from '@/services/minivagasApi';
import type { Company } from '@/types';

type RankView = 'reputation' | 'hired' | 'rejected' | 'noshow';

const PAGE_SIZE = 15;

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

  // Só busca CNPJ se a query tiver dígitos de verdade
  // ("".includes em qualquer CNPJ é sempre true — bug que quebrava a busca por nome)
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

interface HiringRankPanelProps {
  bundle: MinivagasBundle;
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
  const [period, setPeriod] = useState<HiringPeriod>('all');
  const [view, setView] = useState<RankView>('reputation');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const syncLabel = formatSyncAgo(bundle.totals.freezeLastSyncAt, nowTick);

  const { topRejecters, topHired, topNoShows, topReputation } = useMemo(
    () => rankingsForPeriod(bundle, period),
    [bundle, period]
  );

  useEffect(() => {
    setPage(1);
  }, [period, view, search]);

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

  const monthLabel = new Date().toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const totalReprov =
    period === 'all' ? bundle.totals.reprovados : bundle.totals.reprovadosMes;
  const totalHired =
    period === 'all' ? bundle.totals.contratados : bundle.totals.contratadosMes;
  const totalNoShow =
    period === 'all' ? bundle.totals.naoCompareceu : bundle.totals.naoCompareceuMes;
  const totalCandidatos =
    period === 'all'
      ? bundle.totals.enviados
      : bundle.totals.contratadosMes +
        bundle.totals.reprovadosMes +
        bundle.totals.naoCompareceuMes;

  const views: {
    id: RankView;
    label: string;
    description: string;
    icon: typeof Sparkles;
  }[] = [
    {
      id: 'reputation',
      label: 'Reputação',
      description: 'Taxa de contratação',
      icon: Sparkles,
    },
    {
      id: 'hired',
      label: 'Contratados',
      description: 'Quem mais contratou',
      icon: BriefcaseBusiness,
    },
    {
      id: 'rejected',
      label: 'Reprovados',
      description: 'Quem mais reprovou',
      icon: ThumbsDown,
    },
    {
      id: 'noshow',
      label: 'Faltas',
      description: 'Quem mais faltou',
      icon: UserX,
    },
  ];

  const listTitle =
    view === 'reputation'
      ? 'Reputação: quem mais contrata após a entrevista'
      : view === 'hired'
        ? 'Volume: grupos que mais contrataram'
        : view === 'rejected'
          ? 'Volume: grupos que mais reprovaram'
          : 'Volume: grupos com mais faltas';

  const listHint =
    view === 'reputation'
      ? 'Só grupos com 5+ candidatos enviados. Taxa = % contratados sobre enviados. Use a busca e a paginação.'
      : view === 'hired'
        ? 'Lista completa · soma de contratações por grupo. Busque e navegue nas páginas.'
        : view === 'rejected'
          ? 'Lista completa · soma de reprovações por grupo. Busque e navegue nas páginas.'
          : 'Lista completa · soma de faltas por grupo. Busque e navegue nas páginas.';

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('space-y-4', className)}>
        <Alert variant="info">
          <Info />
          <AlertTitle>Como ler este ranking</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Cada linha é um <strong>grupo</strong> (todos os CNPJs cadastrados juntos no
              Minivagas). Os números da linha são a <strong>soma do grupo</strong>.
            </p>
            {view === 'reputation' ? (
              <p>
                Entram só grupos com <strong>5 ou mais candidatos enviados</strong>. A{' '}
                <strong>taxa de contratação</strong> é o % de contratados sobre os enviados
                (inclui quem ainda está em entrevista). Os chips mostram enviados, contratados,
                reprovados e faltas.
              </p>
            ) : (
              <p>
                Nesta aba você vê só o <strong>volume</strong> (quantidade), não a taxa. Clique
                no nome do grupo para abrir cada CNPJ e a ficha no mapa.
              </p>
            )}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="size-4 text-primary shrink-0" />
                  Ranking das empresas
                </CardTitle>
                <CardDescription>
                  Grupo = soma dos CNPJs. Reputação exige 5+ enviados · taxa = contratados /
                  enviados.
                </CardDescription>
              </div>

              <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="gap-1.5 self-start sm:self-end font-medium text-muted-foreground"
                    >
                      <RefreshCw className="size-3" />
                      {syncLabel}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    Quando os dados do ranking foram atualizados pela última vez
                    {bundle.totals.freezeLastSyncAt
                      ? ` · ${new Date(bundle.totals.freezeLastSyncAt).toLocaleString('pt-BR')}`
                      : ''}
                  </TooltipContent>
                </Tooltip>

                <div className="inline-flex rounded-xl bg-muted p-1 self-start sm:self-end">
                  <Button
                    type="button"
                    size="sm"
                    variant={period === 'all' ? 'secondary' : 'ghost'}
                    className={cn(
                      'h-8 rounded-lg px-3',
                      period === 'all' && 'bg-card shadow-sm hover:bg-card'
                    )}
                    onClick={() => setPeriod('all')}
                  >
                    Geral
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={period === 'month' ? 'secondary' : 'ghost'}
                    className={cn(
                      'h-8 rounded-lg px-3 capitalize',
                      period === 'month' && 'bg-card shadow-sm hover:bg-card'
                    )}
                    onClick={() => setPeriod('month')}
                  >
                    {monthLabel}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <StatCard
                label="Candidatos"
                value={totalCandidatos}
                hint="Total no período selecionado"
                tone="neutral"
              />
              <StatCard
                label="Contratados"
                value={totalHired}
                hint="Empresa fechou a vaga com o candidato"
                tone="sky"
                active={view === 'hired'}
                onClick={() => setView('hired')}
              />
              <StatCard
                label="Reprovados"
                value={totalReprov}
                hint="Empresa não aprovou o candidato"
                tone="rose"
                active={view === 'rejected'}
                onClick={() => setView('rejected')}
              />
              <StatCard
                label="Não compareceram"
                value={totalNoShow}
                hint="Candidato faltou na entrevista"
                tone="amber"
                active={view === 'noshow'}
                onClick={() => setView('noshow')}
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 rounded-xl bg-muted/70 p-1.5">
              {views.map((item) => {
                const Icon = item.icon;
                const active = view === item.id;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setView(item.id)}
                    className={cn(
                      'h-auto flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 whitespace-normal text-left',
                      active
                        ? 'bg-card shadow-sm ring-1 ring-border hover:bg-card'
                        : 'text-muted-foreground hover:bg-card/60'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-sm font-semibold',
                        active && item.id === 'reputation' && 'text-primary',
                        active && item.id === 'hired' && 'text-sky-700 dark:text-sky-300',
                        active && item.id === 'rejected' && 'text-rose-700 dark:text-rose-300',
                        active && item.id === 'noshow' && 'text-amber-700 dark:text-amber-300'
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {item.label}
                    </span>
                    <span className="text-[11px] font-normal opacity-70 leading-snug">
                      {item.description}
                    </span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/30 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm">{listTitle}</CardTitle>
                <CardDescription className="mt-1">{listHint}</CardDescription>
              </div>
              {view === 'reputation' && (
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <LegendDot color="bg-sky-500" label="Contratados" />
                  <LegendDot color="bg-rose-500" label="Reprovados" />
                  <LegendDot color="bg-amber-500" label="Faltas" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar grupo, empresa ou CNPJ…"
                  className="pl-9 h-10"
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-muted-foreground shrink-0">
                {filteredCount.toLocaleString('pt-BR')} grupo
                {filteredCount === 1 ? '' : 's'}
                {search.trim()
                  ? ` encontrado${filteredCount === 1 ? '' : 's'} para “${search.trim()}”`
                  : ' no total'}
                {filteredCount > PAGE_SIZE
                  ? ` · página ${safePage} de ${totalPages}`
                  : ''}
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {view === 'reputation' ? (
              <ReputationTable
                rows={pagedReputation}
                startRank={pageStart}
                companies={companies}
                onSelectCompany={onSelectCompany}
              />
            ) : (
              <VolumeTable
                rows={pagedVolume}
                startRank={pageStart}
                maxCount={Math.max(1, ...filteredVolume.map((r) => r.count), 1)}
                companies={companies}
                onSelectCompany={onSelectCompany}
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
              />
            )}

            {filteredCount > PAGE_SIZE ? (
              <div className="border-t px-3 py-3">
                <RankPagination
                  page={safePage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2.5 rounded-full', color)} />
      {label}
    </span>
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
              <PaginationLink
                isActive={item === page}
                onClick={() => onPageChange(item)}
              >
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

function StatCard({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'neutral' | 'sky' | 'rose' | 'amber';
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    neutral: 'bg-muted/60 text-foreground',
    sky: 'bg-sky-50 text-sky-950 dark:bg-sky-950/50 dark:text-sky-50',
    rose: 'bg-rose-50 text-rose-950 dark:bg-rose-950/50 dark:text-rose-50',
    amber: 'bg-amber-50 text-amber-950 dark:bg-amber-950/50 dark:text-amber-50',
  };

  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border px-3 py-3 text-left transition',
        tones[tone],
        onClick && 'cursor-pointer hover:opacity-90',
        active && 'ring-2 ring-primary/35'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex opacity-50 hover:opacity-80"
              onClick={(e) => e.stopPropagation()}
            >
              <CircleHelp className="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      </div>
      <p className="text-xl sm:text-2xl font-bold tabular-nums leading-tight mt-1">
        {value.toLocaleString('pt-BR')}
      </p>
    </Comp>
  );
}

function OutcomeBar({
  hire,
  reject,
  noShow,
}: {
  hire: number;
  reject: number;
  noShow: number;
}) {
  return (
    <div className="h-2.5 rounded-full bg-muted overflow-hidden flex min-w-[7rem]">
      <div className="h-full bg-sky-500" style={{ width: `${hire}%` }} title={`${hire}% contratados`} />
      <div className="h-full bg-rose-500" style={{ width: `${reject}%` }} title={`${reject}% reprovados`} />
      <div className="h-full bg-amber-500" style={{ width: `${noShow}%` }} title={`${noShow}% faltas`} />
    </div>
  );
}

/** Chips claros: Enviados / Contratados / Reprovados / Faltas */
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
  const pad = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]';
  return (
    <div className="flex flex-wrap gap-1.5">
      {enviados != null ? (
        <span
          className={cn(
            'inline-flex items-center rounded-md font-medium tabular-nums',
            'bg-muted text-foreground',
            pad
          )}
        >
          {enviados} enviado{enviados === 1 ? '' : 's'}
        </span>
      ) : null}
      <span
        className={cn(
          'inline-flex items-center rounded-md font-medium tabular-nums',
          'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
          pad
        )}
      >
        {contratados} contratado{contratados === 1 ? '' : 's'}
      </span>
      <span
        className={cn(
          'inline-flex items-center rounded-md font-medium tabular-nums',
          'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
          pad
        )}
      >
        {reprovados} reprovado{reprovados === 1 ? '' : 's'}
      </span>
      <span
        className={cn(
          'inline-flex items-center rounded-md font-medium tabular-nums',
          'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
          pad
        )}
      >
        {naoCompareceu} falta{naoCompareceu === 1 ? '' : 's'}
      </span>
      {emFunil > 0 ? (
        <span
          className={cn(
            'inline-flex items-center rounded-md font-medium tabular-nums',
            'bg-muted text-muted-foreground',
            pad
          )}
        >
          {emFunil} em entrevista
        </span>
      ) : null}
    </div>
  );
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

/** Clique no grupo → lista de CNPJs com métricas individuais. */
function GroupUnitsMenu({
  name,
  memberCount,
  members,
  companies,
  onSelectCompany,
  subtitle,
  mode = 'reputation',
  volumeAccent,
}: {
  name: string;
  memberCount: number;
  members: GroupMemberRef[];
  companies: Company[];
  onSelectCompany: (company: Company) => void;
  subtitle?: string;
  mode?: 'reputation' | 'volume';
  volumeAccent?: 'hired' | 'rejected' | 'noshow';
}) {
  const selectable = members.filter((m) => m.onMap && m.companyId);
  const volumeLabel =
    volumeAccent === 'hired'
      ? 'contratados'
      : volumeAccent === 'rejected'
        ? 'reprovados'
        : volumeAccent === 'noshow'
          ? 'faltas'
          : 'casos';

  return (
    <div className="min-w-0 space-y-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'group flex w-full max-w-full sm:max-w-lg lg:max-w-xl items-center gap-2 rounded-xl border border-border/80 bg-card px-2.5 py-2 text-left',
              'shadow-sm transition-colors cursor-pointer',
              'hover:border-primary/45 hover:bg-accent/50 hover:shadow-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'data-[state=open]:border-primary/50 data-[state=open]:bg-accent/60'
            )}
          >
            <span className="min-w-0 flex-1 truncate font-semibold leading-snug">{name}</span>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-muted/80 px-2 py-1',
                'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground',
                'transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary',
                'group-data-[state=open]:border-primary/30 group-data-[state=open]:bg-primary/10 group-data-[state=open]:text-primary'
              )}
            >
              {memberCount > 1 ? 'Ver CNPJs' : 'Detalhes'}
              <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-[min(26rem,calc(100vw-2rem))] max-h-[min(26rem,70vh)] overflow-y-auto p-1.5"
        >
          <DropdownMenuLabel className="space-y-0.5 px-2 py-2 font-normal">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {memberCount > 1
                ? `${memberCount} unidades deste grupo`
                : 'Unidade deste grupo'}
            </p>
            <p className="text-xs text-muted-foreground">
              Números abaixo são só daquele CNPJ. Clique para abrir os detalhes.
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {members.map((member) => {
            const canOpen = Boolean(member.onMap && member.companyId);
            const decididos =
              member.contratados + member.reprovados + member.naoCompareceu;
            const hasMetrics =
              decididos > 0 || member.emFunil > 0 || member.volumeCount > 0;

            return (
              <DropdownMenuItem
                key={member.cnpjDigits}
                disabled={!canOpen}
                className="items-start gap-2.5 py-3 cursor-pointer"
                onSelect={() => {
                  if (canOpen) openMemberFicha(member, companies, onSelectCompany);
                }}
              >
                <MapPin
                  className={cn(
                    'mt-0.5 size-3.5 shrink-0',
                    canOpen ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <span className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold leading-snug">{member.companyName}</span>
                    {mode === 'reputation' && member.hireRate != null ? (
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold tabular-nums text-primary leading-none">
                          {pctLabel(member.hireRate)}
                        </span>
                        <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                          taxa
                        </span>
                      </span>
                    ) : null}
                    {mode === 'volume' && member.volumeCount > 0 ? (
                      <span className="shrink-0 text-right">
                        <span
                          className={cn(
                            'block text-sm font-bold tabular-nums leading-none',
                            volumeAccent === 'hired' && 'text-sky-700 dark:text-sky-300',
                            volumeAccent === 'rejected' && 'text-rose-700 dark:text-rose-300',
                            volumeAccent === 'noshow' && 'text-amber-700 dark:text-amber-300'
                          )}
                        >
                          {member.volumeCount}
                        </span>
                        <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                          {volumeLabel}
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    CNPJ {formatCnpj(member.cnpjDigits)}
                    {member.onMap ? '' : ' · fora do mapa'}
                  </span>
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
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Sem resultado neste período
                    </span>
                  )}
                  {canOpen ? (
                    <span className="text-[10px] font-medium text-primary">
                      Abrir detalhes →
                    </span>
                  ) : null}
                </span>
              </DropdownMenuItem>
            );
          })}
          {selectable.length === 0 && (
            <p className="px-2 py-2.5 text-xs text-muted-foreground">
              Nenhuma unidade deste grupo está no mapa ainda.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {subtitle ? (
        <p className="text-[11px] text-muted-foreground pl-1">{subtitle}</p>
      ) : null}
    </div>
  );
}

function ReputationTable({
  rows,
  startRank = 0,
  companies,
  onSelectCompany,
}: {
  rows: ReputationRankRow[];
  startRank?: number;
  companies: Company[];
  onSelectCompany: (company: Company) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center px-4">
        Nenhum grupo encontrado. Ajuste a busca ou o período.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12 pl-4">#</TableHead>
          <TableHead>Grupo</TableHead>
          <TableHead className="text-center w-40">
            <span className="block">Taxa de</span>
            <span className="block">contratação</span>
          </TableHead>
          <TableHead className="hidden md:table-cell min-w-[16rem]">
            Resultado após entrevista
          </TableHead>
          <TableHead className="text-right pr-4 w-44">Classificação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const r = row.reputation;
          const hirePct = Math.round((r.hireRate ?? 0) * 100);
          const rejectPct = Math.round((r.rejectRate ?? 0) * 100);
          const noShowPct = Math.round((r.noShowRate ?? 0) * 100);
          const subtitle =
            row.memberCount > 1
              ? `${row.memberCount} CNPJs somados · toque em Ver CNPJs`
              : `1 CNPJ${row.onMap ? '' : ' · fora do mapa'} · toque em Detalhes`;

          return (
            <TableRow key={row.groupKey}>
              <TableCell className="pl-4 align-top pt-4">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {startRank + index + 1}
                </span>
              </TableCell>
              <TableCell className="align-top py-3">
                <GroupUnitsMenu
                  name={row.companyName}
                  memberCount={row.memberCount}
                  members={row.members}
                  companies={companies}
                  onSelectCompany={onSelectCompany}
                  subtitle={subtitle}
                  mode="reputation"
                />
                <div className="md:hidden pt-2 pl-2">
                  <ResultChips
                    enviados={r.enviados}
                    contratados={r.contratados}
                    reprovados={r.reprovados}
                    naoCompareceu={r.naoCompareceu}
                    emFunil={r.emFunil}
                    compact
                  />
                </div>
              </TableCell>
              <TableCell className="text-center align-top py-3">
                <p className="text-2xl font-bold tabular-nums text-primary leading-none">
                  {pctLabel(r.hireRate)}
                </p>
                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground leading-snug">
                  <p>
                    <span className="font-semibold text-foreground tabular-nums">
                      {r.enviados}
                    </span>{' '}
                    enviado{r.enviados === 1 ? '' : 's'}
                  </p>
                  <p>
                    <span className="font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                      {r.contratados}
                    </span>{' '}
                    contratado{r.contratados === 1 ? '' : 's'}
                  </p>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell align-top py-3">
                <div className="space-y-2 max-w-sm">
                  {r.enviados > 0 ? (
                    <OutcomeBar hire={hirePct} reject={rejectPct} noShow={noShowPct} />
                  ) : null}
                  <ResultChips
                    enviados={r.enviados}
                    contratados={r.contratados}
                    reprovados={r.reprovados}
                    naoCompareceu={r.naoCompareceu}
                    emFunil={r.emFunil}
                  />
                </div>
              </TableCell>
              <TableCell className="text-right pr-4 align-top py-3">
                <Badge
                  variant="outline"
                  className={cn('font-semibold', reputationTone(r.label))}
                >
                  {r.label}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug max-w-[10rem] ml-auto">
                  {reputationCriteria(r.label)}
                </p>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function VolumeTable({
  rows,
  startRank = 0,
  maxCount,
  companies,
  onSelectCompany,
  accent,
  empty,
}: {
  rows: HiringRankRow[];
  startRank?: number;
  maxCount?: number;
  companies: Company[];
  onSelectCompany: (company: Company) => void;
  accent: 'hired' | 'rejected' | 'noshow';
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center px-4">{empty}</p>
    );
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
  const valueLabel =
    accent === 'hired' ? 'Contratados' : accent === 'rejected' ? 'Reprovados' : 'Faltas';

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12 pl-4">#</TableHead>
          <TableHead>Grupo</TableHead>
          <TableHead className="hidden sm:table-cell min-w-[10rem]">Comparativo</TableHead>
          <TableHead className="text-right pr-4 w-28">{valueLabel}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const barPct = Math.round((row.count / maxValue) * 100);
          const subtitle =
            row.memberCount > 1
              ? `${row.memberCount} CNPJs somados · toque em Ver CNPJs`
              : `1 CNPJ${row.onMap ? '' : ' · fora do mapa'} · toque em Detalhes`;

          return (
            <TableRow key={row.groupKey}>
              <TableCell className="pl-4">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {startRank + index + 1}
                </span>
              </TableCell>
              <TableCell>
                <GroupUnitsMenu
                  name={row.companyName}
                  memberCount={row.memberCount}
                  members={row.members}
                  companies={companies}
                  onSelectCompany={onSelectCompany}
                  subtitle={subtitle}
                  mode="volume"
                  volumeAccent={accent}
                />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="h-2 rounded-full bg-muted overflow-hidden max-w-xs">
                  <div
                    className={cn('h-full rounded-full', bar)}
                    style={{ width: `${Math.max(barPct, row.count > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </TableCell>
              <TableCell className="text-right pr-4">
                <span className={cn('text-xl font-bold tabular-nums', num)}>
                  {row.count.toLocaleString('pt-BR')}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
