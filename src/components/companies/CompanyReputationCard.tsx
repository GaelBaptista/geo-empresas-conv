import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  reputationTone,
  type CompanyReputation,
} from '@/services/minivagasApi';

function pct(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

export function CompanyReputationCard({
  reputation,
  recruiters,
  className,
}: {
  reputation: CompanyReputation;
  recruiters?: string[];
  className?: string;
}) {
  const hirePct =
    reputation.hireRate != null ? Math.round(reputation.hireRate * 100) : 0;
  const rejectPct =
    reputation.rejectRate != null ? Math.round(reputation.rejectRate * 100) : 0;
  const noShowPct =
    reputation.noShowRate != null ? Math.round(reputation.noShowRate * 100) : 0;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        reputationTone(reputation.label),
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
            Reputação do grupo
          </p>
          <p className="text-lg font-bold mt-0.5">{reputation.label}</p>
          <p className="text-[11px] opacity-80 mt-1 leading-relaxed">
            Reputação pela taxa de aproveitamento da base enviada.
          </p>
          {(recruiters?.length ?? 0) > 0 ? (
            <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-teal-400/70 bg-white/70 px-2.5 py-1.5 dark:bg-black/25">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-800/80 dark:text-teal-200/80">
                Recrutador
              </span>
              <span className="text-sm font-bold text-teal-950 dark:text-teal-50 truncate">
                {recruiters!.join(' · ')}
              </span>
            </div>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold tabular-nums leading-none">
            {pct(reputation.utilizationRate)}
          </p>
          <p className="text-[10px] opacity-70 mt-1">aproveitamento</p>
          <p className="text-[10px] opacity-60 mt-1 tabular-nums">
            perda {pct(reputation.discardRate)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Metric label="Candidatos" value={reputation.enviados} />
        <Metric label="Contratados" value={reputation.contratados} />
        <Metric label="Reprovados" value={reputation.reprovados} />
        <Metric label="Faltas" value={reputation.naoCompareceu} />
        <Metric label="Em entrevista" value={reputation.emFunil} />
      </div>

      {reputation.enviados > 0 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] font-medium">
            <span>Aproveitamento {pct(reputation.utilizationRate)}</span>
            <span className="opacity-75">Perda {pct(reputation.discardRate)}</span>
            <span className="opacity-75">Reprovou {pct(reputation.rejectRate)}</span>
            <span className="opacity-75">Faltou {pct(reputation.noShowRate)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex">
            <div
              className="h-full bg-sky-500"
              style={{ width: `${hirePct}%` }}
              title="Contratados (sobre enviados)"
            />
            <div
              className="h-full bg-rose-500"
              style={{ width: `${rejectPct}%` }}
              title="Reprovados (sobre enviados)"
            />
            <div
              className="h-full bg-amber-500"
              style={{ width: `${noShowPct}%` }}
              title="Não compareceu (sobre enviados)"
            />
          </div>
          <p className="text-[10px] opacity-70">
            Aproveitamento = contratados ÷ enviados · Perda = (reprovados + faltas) ÷ enviados ·{' '}
            {reputation.emFunil} em entrevista
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background/50 dark:bg-background/20 border border-black/5 dark:border-white/10 px-2.5 py-2">
      <p className="text-[10px] opacity-70">{label}</p>
      <p className="text-base font-bold tabular-nums">{value.toLocaleString('pt-BR')}</p>
    </div>
  );
}

export function ReputationBadge({ reputation }: { reputation: CompanyReputation }) {
  return (
    <Badge variant="outline" className={cn('font-semibold', reputationTone(reputation.label))}>
      {reputation.label}
      {reputation.score != null ? ` · ${reputation.score}` : ''}
    </Badge>
  );
}
