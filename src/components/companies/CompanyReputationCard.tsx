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
  className,
}: {
  reputation: CompanyReputation;
  className?: string;
}) {
  const hirePct =
    reputation.hireRate != null ? Math.round(reputation.hireRate * 100) : 0;
  const rejectPct =
    reputation.rejectRate != null ? Math.round(reputation.rejectRate * 100) : 0;

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
            Reputação Minivagas
          </p>
          <p className="text-lg font-bold mt-0.5">{reputation.label}</p>
          <p className="text-[11px] opacity-80 mt-1 leading-relaxed">
            Entre os candidatos com decisão (contratado ou reprovado). Enviados incluem
            também quem ainda está no funil.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold tabular-nums leading-none">
            {reputation.score != null ? reputation.score : '—'}
          </p>
          <p className="text-[10px] opacity-70 mt-1">score / 100</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Enviados" value={reputation.enviados} />
        <Metric label="Contratados" value={reputation.contratados} />
        <Metric label="Reprovados" value={reputation.reprovados} />
        <Metric label="No funil" value={reputation.emFunil} />
      </div>

      {reputation.decididos > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-medium">
            <span>Contratação {pct(reputation.hireRate)}</span>
            <span>Reprovação {pct(reputation.rejectRate)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex">
            <div
              className="h-full bg-sky-500"
              style={{ width: `${hirePct}%` }}
              title="Contratados"
            />
            <div
              className="h-full bg-rose-500"
              style={{ width: `${rejectPct}%` }}
              title="Reprovados"
            />
          </div>
          <p className="text-[10px] opacity-70">
            {reputation.decididos} decisão(ões) · {reputation.emFunil} ainda no funil
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
