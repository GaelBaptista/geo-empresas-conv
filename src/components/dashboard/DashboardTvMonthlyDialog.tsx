import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  formatMonthYearPt,
  shiftMonthISO,
  type Hire,
} from '@/lib/dashboard-tv';
import {
  getMonthlySummary,
  type MonthlySummaryData,
} from '@/services/monthlySummaryApi';

const nf = new Intl.NumberFormat('pt-BR');

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  preloadedHires?: Hire[];
};

function StatBox({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'danger' | 'warn';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
      : tone === 'danger'
        ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
        : tone === 'warn'
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
          : 'border-border bg-muted/40';

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{nf.format(value)}</p>
    </div>
  );
}

function CompanyList({
  title,
  map,
}: {
  title: string;
  map: Record<string, number>;
}) {
  const entries = Object.entries(map).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="space-y-1.5">
        {entries.slice(0, 12).map(([name, count]) => (
          <div
            key={name}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <span className="truncate">{name}</span>
            <Badge variant="secondary">{nf.format(count)}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardTvMonthlyDialog({
  open,
  onOpenChange,
  date,
  preloadedHires,
}: Props) {
  const [currentDate, setCurrentDate] = useState(date);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MonthlySummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (open) {
      setCurrentDate(date);
    } else {
      setData(null);
      setError(null);
    }
  }, [open, date]);

  useEffect(() => {
    if (!open || !currentDate) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    getMonthlySummary(currentDate, { preloadedHires })
      .then((summaryData) => {
        if (requestId !== requestIdRef.current) return;
        setData(summaryData);
      })
      .catch((e) => {
        if (requestId !== requestIdRef.current) return;
        console.error(e);
        setError('Erro ao carregar dados mensais');
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [open, currentDate, preloadedHires]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={loading}
              onClick={() => setCurrentDate((d) => shiftMonthISO(d, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <DialogTitle className="flex-1 text-center text-base">
              Resumo Mensal — {formatMonthYearPt(currentDate)}
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={loading}
              onClick={() => setCurrentDate((d) => shiftMonthISO(d, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="space-y-5 p-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando resumo...
              </div>
            ) : error ? (
              <p className="py-8 text-center text-sm text-rose-600">{error}</p>
            ) : data ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatBox label="Entraram no mês" value={data.entered} />
                  <StatBox label="Saíram no mês" value={data.left} tone="danger" />
                  <StatBox
                    label="Saídas por iniciativa do estagiário"
                    value={data.leftByTraineeInitiative}
                    tone="warn"
                  />
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="mb-1 text-sm font-medium">Vagas preenchidas no mês</p>
                  <p className="mb-3 text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {nf.format(data.filledPositions)}
                  </p>
                  <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">CE</p>
                      <p className="text-lg font-semibold">
                        {nf.format(data.filledPositionsByUF.ce)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">RN</p>
                      <p className="text-lg font-semibold">
                        {nf.format(data.filledPositionsByUF.rn)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Outros</p>
                      <p className="text-lg font-semibold">
                        {nf.format(data.filledPositionsByUF.outros)}
                      </p>
                    </div>
                  </div>
                  {data.filledPositionsByUF.outros > 0 &&
                    Object.keys(data.filledPositionsByUF.outrosByState).length > 0 && (
                      <div className="flex flex-wrap gap-2 border-t border-emerald-200/80 pt-3 dark:border-emerald-800">
                        {Object.entries(data.filledPositionsByUF.outrosByState)
                          .sort(([, a], [, b]) => b - a)
                          .map(([state, count]) => (
                            <Badge key={state} variant="outline">
                              {state}: {nf.format(count)}
                            </Badge>
                          ))}
                      </div>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatBox
                    label="Aprovados"
                    value={data.status.aprovados}
                    tone="success"
                  />
                  <StatBox
                    label="Reprovados"
                    value={data.status.reprovados}
                    tone="danger"
                  />
                  <StatBox label="Contratados" value={data.status.contratados} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <CompanyList
                    title="Aprovados por empresa"
                    map={data.aprovadosByCompany}
                  />
                  <CompanyList
                    title="Reprovados empresa"
                    map={data.reprovadosEmpresaByCompany}
                  />
                  <CompanyList
                    title="Contratados por empresa"
                    map={data.contratadosByCompany}
                  />
                </div>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
