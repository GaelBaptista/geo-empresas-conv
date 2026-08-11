import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  DAYS,
  type DayKey,
  type HiresWeekDay,
  type WeeklyState,
} from '@/lib/dashboard-tv';

type WeekPoint = { day: string; entered: number; left: number };

const DAY_ABBR: Record<string, string> = {
  'segunda-feira': 'seg',
  'terça-feira': 'ter',
  'quarta-feira': 'qua',
  'quinta-feira': 'qui',
  'sexta-feira': 'sex',
};

const STATUS_LABEL: Record<keyof WeeklyState['totals'], string> = {
  triados: 'Triados',
  entrevista_online: 'Ent. Online',
  entrevista_presencial: 'Ent. Presencial',
  reprovados: 'Reprovados',
  nao_compareceram: 'Não Compareceram',
  aprovados: 'Aprovados',
  contratados: 'Contratados',
};

const nf = new Intl.NumberFormat('pt-BR');
const C_ENTERED = '#16a34a';
const C_LEFT = '#dc2626';

function todayIdx(): 1 | 2 | 3 | 4 | 5 {
  const dow = new Date().getDay() || 7;
  return Math.min(dow, 5) as 1 | 2 | 3 | 4 | 5;
}

const DAY_IDX: Record<DayKey, 1 | 2 | 3 | 4 | 5> = {
  'segunda-feira': 1,
  'terça-feira': 2,
  'quarta-feira': 3,
  'quinta-feira': 4,
  'sexta-feira': 5,
};

function toDailyWeek(week: WeekPoint[]): (WeekPoint & { label: string })[] {
  const base = DAYS.map((d) => ({
    day: d,
    label: DAY_ABBR[d] ?? d,
    entered: 0,
    left: 0,
  }));
  const idx: Record<string, number> = {};
  DAYS.forEach((d, i) => {
    idx[d] = i;
  });
  (week || []).forEach((p) => {
    const k = String(p?.day || '').toLowerCase();
    if (idx[k] != null) {
      base[idx[k]].entered = Number(p.entered || 0);
      base[idx[k]].left = Number(p.left || 0);
    }
  });
  const tIdx = todayIdx();
  return base.map((row) => {
    const isFuture = DAY_IDX[row.day as DayKey] > tIdx;
    return isFuture ? { ...row, entered: 0, left: 0 } : row;
  });
}

function ChartValueLabel(props: {
  x?: number | string;
  y?: number | string;
  value?: number | string;
  dy?: number;
}) {
  const { value, dy = -10 } = props;
  const x = typeof props.x === 'number' ? props.x : Number(props.x);
  const y = typeof props.y === 'number' ? props.y : Number(props.y);
  if (value == null || Number(value) === 0 || Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }
  return (
    <text
      x={x}
      y={y + dy}
      textAnchor="middle"
      fontSize={12}
      fill="currentColor"
      className="fill-foreground"
      fontWeight={600}
    >
      {nf.format(Number(value))}
    </text>
  );
}

function WeeklyStateTable({
  title,
  rows,
  summary,
  outrosUFs,
}: {
  title: string;
  rows: { day: DayKey; vagas: number }[];
  summary: WeeklyState;
  outrosUFs?: Record<string, number>;
}) {
  const data = useMemo(() => {
    const byDay: Record<string, number> = {};
    (rows || []).forEach((r) => {
      byDay[r.day] = r.vagas ?? 0;
    });
    return DAYS.map((d) => ({ day: d, vagas: byDay[d] ?? 0 }));
  }, [rows]);

  const totalVagas = data.reduce((acc, r) => acc + r.vagas, 0);
  const statusKeys = Object.keys(STATUS_LABEL) as (keyof WeeklyState['totals'])[];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary">Vagas na semana: {nf.format(totalVagas)}</Badge>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {data.map((r) => (
          <div
            key={r.day}
            className="rounded-lg border bg-muted/30 px-2 py-2 text-center"
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {DAY_ABBR[r.day]}
            </div>
            <div className="text-lg font-semibold tabular-nums">{nf.format(r.vagas)}</div>
          </div>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            {DAYS.map((d) => (
              <TableHead key={d} className="text-right">
                {DAY_ABBR[d]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {statusKeys.map((key) => (
            <TableRow key={key}>
              <TableCell className="font-medium">{STATUS_LABEL[key]}</TableCell>
              <TableCell className="text-right tabular-nums">
                {nf.format(summary.totals[key] || 0)}
              </TableCell>
              {DAYS.map((d) => (
                <TableCell key={d} className="text-right tabular-nums text-muted-foreground">
                  {nf.format(summary.byDay[d]?.[key] || 0)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {outrosUFs && Object.keys(outrosUFs).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Contratados por UF (outros)
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(outrosUFs)
              .sort(([, a], [, b]) => b - a)
              .map(([uf, n]) => (
                <Badge key={uf} variant="outline">
                  {uf}: {nf.format(n)}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Mode = 'chart' | 'tableCE' | 'tableRN' | 'tableOutros';

export function DashboardTvChartSwitcher({
  week = [],
  hiresWeek = [],
  weeklyCE,
  weeklyRN,
  weeklyOutros,
  outrosUFs,
  rotateMs = 45000,
  className,
}: {
  week: WeekPoint[];
  hiresWeek: HiresWeekDay[];
  weeklyCE: WeeklyState;
  weeklyRN: WeeklyState;
  weeklyOutros: WeeklyState;
  outrosUFs?: Record<string, number>;
  rotateMs?: number;
  className?: string;
}) {
  const data = useMemo(() => toDailyWeek(week), [week]);
  const order: Mode[] = ['chart', 'tableCE', 'tableRN', 'tableOutros'];
  const [mode, setMode] = useState<Mode>('chart');
  const timerRef = useRef<number | null>(null);

  const rowsCE = useMemo(() => {
    const by: Record<string, number> = {};
    (hiresWeek || []).forEach((h) => {
      by[h.day] = h?.ce?.vagas || 0;
    });
    return DAYS.map((d) => ({ day: d, vagas: by[d] ?? 0 }));
  }, [hiresWeek]);

  const rowsRN = useMemo(() => {
    const by: Record<string, number> = {};
    (hiresWeek || []).forEach((h) => {
      by[h.day] = h?.rn?.vagas || 0;
    });
    return DAYS.map((d) => ({ day: d, vagas: by[d] ?? 0 }));
  }, [hiresWeek]);

  const rowsOutros = useMemo(() => {
    const by: Record<string, number> = {};
    (hiresWeek || []).forEach((h) => {
      by[h.day] = h?.outros?.vagas || 0;
    });
    return DAYS.map((d) => ({ day: d, vagas: by[d] ?? 0 }));
  }, [hiresWeek]);

  const next = useCallback(() => {
    setMode((m) => order[(order.indexOf(m) + 1) % order.length]);
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

  const goTo = (k: Mode) => {
    setMode(k);
    resetAuto();
  };

  const sumEntered = data.reduce((a, d) => a + d.entered, 0);
  const sumLeft = data.reduce((a, d) => a + d.left, 0);

  return (
    <Card className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-muted p-1.5 text-muted-foreground">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base">Entradas & Saídas na Semana</CardTitle>
            <p className="text-[11px] text-muted-foreground">seg → sex</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Entradas:{' '}
            <strong className="text-emerald-600">{nf.format(sumEntered)}</strong>
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Saídas: <strong className="text-rose-600">{nf.format(sumLeft)}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            {order.map((k) => (
              <Button
                key={k}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Ir para ${k}`}
                onClick={() => goTo(k)}
                className="size-5 rounded-full p-0"
              >
                <span
                  className={cn(
                    'block size-2.5 rounded-full transition-colors',
                    mode === k ? 'bg-foreground' : 'bg-muted-foreground/40'
                  )}
                />
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative min-h-0 flex-1 p-3">
        <div
          className={cn(
            'absolute inset-3 transition-opacity',
            mode === 'chart' ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="label"
                interval={0}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val) => nf.format(Number(val || 0))}
                labelFormatter={(lab) => `Dia: ${lab}`}
              />
              <Area
                type="monotone"
                dataKey="entered"
                name="Entradas"
                stroke={C_ENTERED}
                strokeWidth={2.5}
                fill={`${C_ENTERED}14`}
                dot={{ r: 4, stroke: '#fff', strokeWidth: 1.5, fill: C_ENTERED }}
              >
                <LabelList
                  dataKey="entered"
                  content={(p) => (
                    <ChartValueLabel
                      x={p.x as number | string | undefined}
                      y={p.y as number | string | undefined}
                      value={p.value as number | string | undefined}
                      dy={-12}
                    />
                  )}
                />
              </Area>
              <Area
                type="monotone"
                dataKey="left"
                name="Saídas"
                stroke={C_LEFT}
                strokeWidth={2.5}
                fill={`${C_LEFT}14`}
                dot={{ r: 4, stroke: '#fff', strokeWidth: 1.5, fill: C_LEFT }}
              >
                <LabelList
                  dataKey="left"
                  content={(p) => (
                    <ChartValueLabel
                      x={p.x as number | string | undefined}
                      y={p.y as number | string | undefined}
                      value={p.value as number | string | undefined}
                      dy={16}
                    />
                  )}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div
          className={cn(
            'absolute inset-3 transition-opacity',
            mode === 'tableCE' ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <WeeklyStateTable
            title="Resumo semanal de vagas — CE"
            rows={rowsCE}
            summary={weeklyCE}
          />
        </div>

        <div
          className={cn(
            'absolute inset-3 transition-opacity',
            mode === 'tableRN' ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <WeeklyStateTable
            title="Resumo semanal de vagas — RN"
            rows={rowsRN}
            summary={weeklyRN}
          />
        </div>

        <div
          className={cn(
            'absolute inset-3 transition-opacity',
            mode === 'tableOutros' ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <WeeklyStateTable
            title="Resumo semanal de vagas — Outros Estados"
            rows={rowsOutros}
            summary={weeklyOutros}
            outrosUFs={outrosUFs}
          />
        </div>
      </CardContent>
    </Card>
  );
}
