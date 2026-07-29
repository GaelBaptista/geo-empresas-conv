import { useMemo, useState } from 'react';
import {
  ThumbsDown,
  BriefcaseBusiness,
  Building2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

type RankView = 'reputation' | 'hired' | 'rejected';

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

  const { topRejecters, topHired, topReputation } = useMemo(
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
  const totalEnviados =
    period === 'all'
      ? bundle.totals.enviados
      : bundle.totals.contratadosMes + bundle.totals.reprovadosMes;

  const views: { id: RankView; label: string; hint: string; icon: typeof Sparkles }[] = [
    {
      id: 'reputation',
      label: 'Reputação',
      hint: 'Quem mais contrata (em %)',
      icon: Sparkles,
    },
    {
      id: 'hired',
      label: 'Contratados',
      hint: 'Quem mais contratou (volume)',
      icon: BriefcaseBusiness,
    },
    {
      id: 'rejected',
      label: 'Reprovados',
      hint: 'Quem mais reprovou (volume)',
      icon: ThumbsDown,
    },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Barra flutuante / sticky */}
      <div className="sticky top-2 z-20 rounded-2xl border bg-card/95 backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-black/30 p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-primary shrink-0" />
              Ranking das empresas
            </h2>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-xl">
              Reputação = % de candidatos contratados entre os que já tiveram decisão
              (contratado ou reprovado). Clique numa empresa para abrir a ficha.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 shrink-0 self-start">
            {(
              [
                { id: 'all' as const, label: 'Geral' },
                { id: 'month' as const, label: monthLabel },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition cursor-pointer capitalize',
                  period === item.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Resumo em números grandes */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryChip
            label="Enviados"
            value={totalEnviados}
            tone="bg-muted/80 text-foreground"
            active={false}
          />
          <SummaryChip
            label="Contratados"
            value={totalHired}
            tone="bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100"
            active={view === 'hired'}
            onClick={() => setView('hired')}
          />
          <SummaryChip
            label="Reprovados"
            value={totalReprov}
            tone="bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-100"
            active={view === 'rejected'}
            onClick={() => setView('rejected')}
          />
        </div>

        {/* Abas lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 rounded-xl bg-muted/80 p-1.5">
          {views.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-left transition cursor-pointer',
                  active
                    ? 'bg-card shadow-sm ring-1 ring-border'
                    : 'hover:bg-card/60 text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-semibold',
                    active && item.id === 'reputation' && 'text-primary',
                    active && item.id === 'hired' && 'text-sky-700 dark:text-sky-300',
                    active && item.id === 'rejected' && 'text-rose-700 dark:text-rose-300'
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </span>
                <span className="block text-[10px] mt-0.5 opacity-70 leading-snug">
                  {item.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da aba ativa */}
      {view === 'reputation' && (
        <ReputationList
          rows={topReputation}
          companies={companies}
          onSelectCompany={onSelectCompany}
        />
      )}
      {view === 'hired' && (
        <VolumeList
          rows={topHired}
          companies={companies}
          onSelectCompany={onSelectCompany}
          total={totalHired}
          accent="hired"
          empty="Nenhuma contratação neste período."
        />
      )}
      {view === 'rejected' && (
        <VolumeList
          rows={topRejecters}
          companies={companies}
          onSelectCompany={onSelectCompany}
          total={totalReprov}
          accent="rejected"
          empty="Nenhuma reprovação neste período."
        />
      )}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border px-2.5 py-2 text-left transition',
        tone,
        onClick && 'cursor-pointer hover:opacity-90',
        active && 'ring-2 ring-primary/40'
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg sm:text-xl font-bold tabular-nums leading-tight mt-0.5">
        {value.toLocaleString('pt-BR')}
      </p>
    </Comp>
  );
}

function ReputationList({
  rows,
  companies,
  onSelectCompany,
}: {
  rows: ReputationRankRow[];
  companies: Company[];
  onSelectCompany: (company: Company) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-primary/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
            <TrendingUp className="size-4" />
            Melhores em reputação
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Empresas que mais aproveitam os candidatos enviados
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-sky-500" />
            Contratou
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-500" />
            Reprovou
          </span>
        </div>
      </div>

      <div className="divide-y">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center px-4">
            Ainda sem empresas com volume suficiente de decisões.
          </p>
        ) : (
          rows.map((row, index) => {
            const company = row.companyId
              ? companies.find((c) => c.id === row.companyId)
              : undefined;
            const r = row.reputation;
            const hirePct = Math.round((r.hireRate ?? 0) * 100);
            const rejectPct = Math.round((r.rejectRate ?? 0) * 100);

            return (
              <button
                key={row.cnpjDigits}
                type="button"
                disabled={!company}
                onClick={() => company && onSelectCompany(company)}
                className={cn(
                  'w-full text-left px-3 sm:px-4 py-3.5 transition',
                  company
                    ? 'hover:bg-primary/5 cursor-pointer'
                    : 'opacity-80 cursor-default'
                )}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="size-8 rounded-full bg-muted text-xs font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>

                  {/* % grande — o número que importa */}
                  <div className="shrink-0 w-14 sm:w-16 text-center">
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums text-primary leading-none">
                      {pctLabel(r.hireRate)}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wide">
                      contratou
                    </p>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate leading-snug">
                          {row.companyName}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          CNPJ {formatCnpj(row.cnpjDigits)}
                          {!row.onMap ? ' · fora do mapa' : ''}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 font-semibold text-[10px]',
                          reputationTone(r.label)
                        )}
                      >
                        {r.label}
                        {r.score != null ? ` · ${r.score}` : ''}
                      </Badge>
                    </div>

                    <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                      <div
                        className="h-full bg-sky-500"
                        style={{ width: `${hirePct}%` }}
                        title={`${hirePct}% contratados`}
                      />
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${rejectPct}%` }}
                        title={`${rejectPct}% reprovados`}
                      />
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-sky-700 dark:text-sky-300 font-medium">
                        {r.contratados.toLocaleString('pt-BR')} contratados
                      </span>
                      <span className="text-rose-700 dark:text-rose-300 font-medium">
                        {r.reprovados.toLocaleString('pt-BR')} reprovados
                      </span>
                      <span className="text-muted-foreground">
                        {r.enviados.toLocaleString('pt-BR')} enviados
                        {r.emFunil > 0
                          ? ` · ${r.emFunil.toLocaleString('pt-BR')} no funil`
                          : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function VolumeList({
  rows,
  companies,
  onSelectCompany,
  total,
  accent,
  empty,
}: {
  rows: HiringRankRow[];
  companies: Company[];
  onSelectCompany: (company: Company) => void;
  total: number;
  accent: 'hired' | 'rejected';
  empty: string;
}) {
  const maxValue = Math.max(1, ...rows.map((r) => r.count));
  const isHired = accent === 'hired';

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div
        className={cn(
          'px-4 py-3 border-b',
          isHired
            ? 'bg-sky-50 dark:bg-sky-950/50'
            : 'bg-rose-50 dark:bg-rose-950/50'
        )}
      >
        <h3
          className={cn(
            'text-sm font-semibold flex items-center gap-2',
            isHired
              ? 'text-sky-800 dark:text-sky-200'
              : 'text-rose-800 dark:text-rose-200'
          )}
        >
          {isHired ? (
            <BriefcaseBusiness className="size-4" />
          ) : (
            <ThumbsDown className="size-4" />
          )}
          {isHired ? 'Quem mais contratou' : 'Quem mais reprovou'}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {total.toLocaleString('pt-BR')} no total · top {rows.length} empresas por volume
        </p>
      </div>

      <div className="divide-y">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center px-4">{empty}</p>
        ) : (
          rows.map((row, index) => {
            const company = row.companyId
              ? companies.find((c) => c.id === row.companyId)
              : undefined;
            const barPct = Math.round((row.count / maxValue) * 100);

            return (
              <button
                key={row.cnpjDigits}
                type="button"
                disabled={!company}
                onClick={() => company && onSelectCompany(company)}
                className={cn(
                  'w-full text-left px-3 sm:px-4 py-3.5 transition',
                  company
                    ? 'hover:bg-muted/50 cursor-pointer'
                    : 'opacity-80 cursor-default'
                )}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <span
                    className={cn(
                      'size-8 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                      isHired
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100'
                    )}
                  >
                    {index + 1}
                  </span>

                  <div className="shrink-0 w-14 sm:w-16 text-center">
                    <p
                      className={cn(
                        'text-2xl sm:text-3xl font-bold tabular-nums leading-none',
                        isHired
                          ? 'text-sky-700 dark:text-sky-300'
                          : 'text-rose-700 dark:text-rose-300'
                      )}
                    >
                      {row.count.toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="text-sm font-semibold truncate leading-snug">
                        {row.companyName}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        CNPJ {formatCnpj(row.cnpjDigits)}
                        {row.onMap ? '' : ' · não está no mapa'}
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          isHired ? 'bg-sky-500' : 'bg-rose-500'
                        )}
                        style={{ width: `${Math.max(barPct, row.count > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
