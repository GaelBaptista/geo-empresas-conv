import { useMemo, useState } from 'react';
import {
  ThumbsDown,
  BriefcaseBusiness,
  Building2,
  Sparkles,
  UserX,
  Info,
  CircleHelp,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  rankingsForPeriod,
  reputationTone,
  type HiringPeriod,
  type HiringRankRow,
  type MinivagasBundle,
  type ReputationRankRow,
} from '@/services/minivagasApi';
import type { Company } from '@/types';

type RankView = 'reputation' | 'hired' | 'rejected' | 'noshow';

function formatCnpj(digits: string): string {
  if (digits.length !== 14) return digits;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function pctLabel(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
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

  const { topRejecters, topHired, topNoShows, topReputation } = useMemo(
    () => rankingsForPeriod(bundle, period),
    [bundle, period]
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
      description: 'Quem mais contrata',
      icon: Sparkles,
    },
    {
      id: 'hired',
      label: 'Contratados',
      description: 'Volume de contratações',
      icon: BriefcaseBusiness,
    },
    {
      id: 'rejected',
      label: 'Reprovados',
      description: 'Empresa rejeitou',
      icon: ThumbsDown,
    },
    {
      id: 'noshow',
      label: 'Faltas',
      description: 'Não compareceram',
      icon: UserX,
    },
  ];

  const listTitle =
    view === 'reputation'
      ? 'Empresas com melhor taxa de contratação'
      : view === 'hired'
        ? 'Empresas que mais contrataram'
        : view === 'rejected'
          ? 'Empresas que mais reprovaram'
          : 'Empresas com mais faltas na entrevista';

  const listHint =
    view === 'reputation'
      ? 'Ordenado pela % de candidatos contratados depois da entrevista.'
      : view === 'hired'
        ? 'Quantidade de candidatos contratados neste período.'
        : view === 'rejected'
          ? 'Candidatos que a empresa reprovou após a entrevista.'
          : 'Candidatos que não compareceram à entrevista.';

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('space-y-4', className)}>
        <Alert variant="info">
          <Info />
          <AlertTitle>Como ler este ranking</AlertTitle>
          <AlertDescription>
            <p>
              Aqui você vê o resultado dos candidatos que enviamos para entrevista: a empresa{' '}
              <strong>contratou</strong>, <strong>reprovou</strong> ou o candidato{' '}
              <strong>faltou</strong>. Quanto maior a taxa de contratação, melhor a reputação do
              grupo.
            </p>
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
                  Compare grupos e unidades pelo desempenho na seleção.
                </CardDescription>
              </div>

              <div className="inline-flex rounded-xl bg-muted p-1 shrink-0 self-start">
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
          <CardHeader className="pb-3 border-b bg-muted/30">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm">{listTitle}</CardTitle>
                <CardDescription className="mt-1">{listHint}</CardDescription>
              </div>
              {view === 'reputation' && (
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <LegendDot color="bg-sky-500" label="Contratou" />
                  <LegendDot color="bg-rose-500" label="Reprovou" />
                  <LegendDot color="bg-amber-500" label="Faltou" />
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {view === 'reputation' ? (
              <ReputationTable
                rows={topReputation}
                companies={companies}
                onSelectCompany={onSelectCompany}
              />
            ) : (
              <VolumeTable
                rows={
                  view === 'hired'
                    ? topHired
                    : view === 'rejected'
                      ? topRejecters
                      : topNoShows
                }
                companies={companies}
                onSelectCompany={onSelectCompany}
                accent={view === 'hired' ? 'hired' : view === 'rejected' ? 'rejected' : 'noshow'}
                empty={
                  view === 'hired'
                    ? 'Nenhuma contratação neste período.'
                    : view === 'rejected'
                      ? 'Nenhuma reprovação neste período.'
                      : 'Nenhuma falta neste período.'
                }
              />
            )}
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
    <div className="h-2 rounded-full bg-muted overflow-hidden flex min-w-[7rem]">
      <div className="h-full bg-sky-500" style={{ width: `${hire}%` }} />
      <div className="h-full bg-rose-500" style={{ width: `${reject}%` }} />
      <div className="h-full bg-amber-500" style={{ width: `${noShow}%` }} />
    </div>
  );
}

function ReputationTable({
  rows,
  companies,
  onSelectCompany,
}: {
  rows: ReputationRankRow[];
  companies: Company[];
  onSelectCompany: (company: Company) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center px-4">
        Ainda não há empresas com volume suficiente para ranquear.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12 pl-4">#</TableHead>
          <TableHead>Empresa / grupo</TableHead>
          <TableHead className="text-center w-24">Contratou</TableHead>
          <TableHead className="hidden md:table-cell min-w-[12rem]">Resultado</TableHead>
          <TableHead className="text-right pr-4 w-32">Avaliação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const company = row.companyId
            ? companies.find((c) => c.id === row.companyId)
            : undefined;
          const r = row.reputation;
          const hirePct = Math.round((r.hireRate ?? 0) * 100);
          const rejectPct = Math.round((r.rejectRate ?? 0) * 100);
          const noShowPct = Math.round((r.noShowRate ?? 0) * 100);

          return (
            <TableRow
              key={row.groupKey}
              className={cn(company && 'cursor-pointer')}
              onClick={() => company && onSelectCompany(company)}
            >
              <TableCell className="pl-4">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {index + 1}
                </span>
              </TableCell>
              <TableCell>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold leading-snug truncate max-w-[16rem] sm:max-w-md">
                    {row.companyName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.groupId != null
                      ? `${row.memberCount} unidade(s) no grupo`
                      : `CNPJ ${formatCnpj(row.cnpjDigits)}`}
                    {!row.onMap ? ' · fora do mapa' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground md:hidden pt-1">
                    {r.contratados} contrat. · {r.reprovados} reprov. · {r.naoCompareceu} falta
                    {r.emFunil > 0 ? ` · ${r.emFunil} em entrevista` : ''}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <p className="text-xl font-bold tabular-nums text-primary leading-none">
                  {pctLabel(r.hireRate)}
                </p>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="space-y-1.5 max-w-xs">
                  <OutcomeBar hire={hirePct} reject={rejectPct} noShow={noShowPct} />
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    <span className="text-sky-700 dark:text-sky-300 font-medium">
                      {r.contratados} contratados
                    </span>
                    {' · '}
                    <span className="text-rose-700 dark:text-rose-300 font-medium">
                      {r.reprovados} reprovados
                    </span>
                    {' · '}
                    <span className="text-amber-700 dark:text-amber-300 font-medium">
                      {r.naoCompareceu} faltas
                    </span>
                    {r.emFunil > 0
                      ? ` · ${r.emFunil} ainda em entrevista`
                      : ''}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-right pr-4">
                <Badge
                  variant="outline"
                  className={cn('font-semibold', reputationTone(r.label))}
                >
                  {r.label}
                  {r.score != null ? ` · ${r.score}` : ''}
                </Badge>
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
  companies,
  onSelectCompany,
  accent,
  empty,
}: {
  rows: HiringRankRow[];
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

  const maxValue = Math.max(1, ...rows.map((r) => r.count));
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
          <TableHead>Empresa</TableHead>
          <TableHead className="hidden sm:table-cell min-w-[10rem]">Comparativo</TableHead>
          <TableHead className="text-right pr-4 w-28">{valueLabel}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const company = row.companyId
            ? companies.find((c) => c.id === row.companyId)
            : undefined;
          const barPct = Math.round((row.count / maxValue) * 100);

          return (
            <TableRow
              key={row.cnpjDigits}
              className={cn(company && 'cursor-pointer')}
              onClick={() => company && onSelectCompany(company)}
            >
              <TableCell className="pl-4">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {index + 1}
                </span>
              </TableCell>
              <TableCell>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug truncate max-w-[16rem] sm:max-w-md">
                    {row.companyName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    CNPJ {formatCnpj(row.cnpjDigits)}
                    {row.onMap ? '' : ' · fora do mapa'}
                  </p>
                </div>
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
