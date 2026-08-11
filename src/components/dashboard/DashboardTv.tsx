import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Circle,
  Expand,
  Loader2,
  LogIn,
  LogOut,
  Minimize2,
  RefreshCw,
  UserMinus,
  Users,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  aggregateHiresToday,
  aggregateHiresWeek,
  blankWeeklyState,
  countMovedToday,
  fetchWeeklyStatusByUFWithMoves,
  normText,
  readRefreshMin,
  REFRESH_MIN_OPTIONS,
  todayLocalISO,
  writeRefreshMin,
  getDashboardTvTodayMessage,
  type Hire,
  type HiresTodayAgg,
  type HiresWeekDay,
  type WeeklyState,
} from '@/lib/dashboard-tv';
import {
  getDashboardTv,
  getTotalContracts,
  type WeekItem,
} from '@/services/dashboardTvApi';
import {
  getCandidatesMovedTo,
  getContratados,
} from '@/services/dashboardTvStatusApi';
import { prefetchMonthlySummary } from '@/services/monthlySummaryApi';
import { DashboardTvChartSwitcher } from '@/components/dashboard/DashboardTvChartSwitcher';
import { DashboardTvMonthlyDialog } from '@/components/dashboard/DashboardTvMonthlyDialog';
import { DashboardTvTopRanking } from '@/components/dashboard/DashboardTvTopRanking';
import { DashboardTvMusicToggle } from '@/components/dashboard/DashboardTvMusicToggle';
import type { DrvagasBundle } from '@/services/drvagasApi';

const nf = new Intl.NumberFormat('pt-BR');

type LoadStepStatus = 'pending' | 'loading' | 'done' | 'error';

type LoadStep = {
  id: string;
  label: string;
  description: string;
  status: LoadStepStatus;
};

type Props = {
  fullscreen?: boolean;
  onEnterFullscreen?: () => void;
  onExitFullscreen?: () => void;
  drvagas?: DrvagasBundle | null;
};

type KpiTone = 'blue' | 'green' | 'red' | 'amber';

function KpiCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  tone: KpiTone;
}) {
  const toneClass: Record<KpiTone, string> = {
    blue: 'border-sky-200/70 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/25',
    green:
      'border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/25',
    red: 'border-rose-200/70 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/25',
    amber:
      'border-amber-200/70 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/25',
  };
  const iconTone: Record<KpiTone, string> = {
    blue: 'text-sky-600 bg-sky-100/80 dark:text-sky-300 dark:bg-sky-950/60',
    green: 'text-emerald-600 bg-emerald-100/80 dark:text-emerald-300 dark:bg-emerald-950/60',
    red: 'text-rose-600 bg-rose-100/80 dark:text-rose-300 dark:bg-rose-950/60',
    amber: 'text-amber-600 bg-amber-100/80 dark:text-amber-300 dark:bg-amber-950/60',
  };

  return (
    <Card className={cn('overflow-hidden', toneClass[tone])}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('rounded-xl p-2.5 shadow-sm', iconTone[tone])}>{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            {nf.format(value)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StepIcon({ status }: { status: LoadStepStatus }) {
  if (status === 'loading') return <Loader2 className="size-4 animate-spin text-sky-600" />;
  if (status === 'done') return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === 'error') return <XCircle className="size-4 text-rose-600" />;
  return <Circle className="size-4 text-muted-foreground/50" />;
}

type UfSlide = {
  uf: string;
  today: number;
  week: number;
  tone: KpiTone;
};

function FilledPositionsSlider({
  slides,
  rotateMs = 20000,
}: {
  slides: UfSlide[];
  rotateMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, rotateMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [slides.length, rotateMs]);

  const slide = slides[index] ?? slides[0];
  if (!slide) return null;

  const toneBorder: Record<KpiTone, string> = {
    blue: 'border-sky-200/80 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20',
    green:
      'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20',
    red: 'border-rose-200/80 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20',
    amber:
      'border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20',
  };
  const toneLabel: Record<KpiTone, string> = {
    blue: 'text-sky-700 dark:text-sky-300',
    green: 'text-emerald-700 dark:text-emerald-300',
    red: 'text-rose-700 dark:text-rose-300',
    amber: 'text-amber-700 dark:text-amber-300',
  };

  return (
    <Card className="flex-shrink-0 overflow-hidden">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Vagas preenchidas</p>
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.uf}
                type="button"
                aria-label={s.uf}
                onClick={() => setIndex(i)}
                className={cn(
                  'size-2 rounded-full transition-colors',
                  i === index ? 'bg-foreground' : 'bg-muted-foreground/35'
                )}
              />
            ))}
          </div>
        </div>

        <div
          key={slide.uf}
          className={cn(
            'rounded-xl border px-3 py-3 transition-all duration-500',
            toneBorder[slide.tone]
          )}
        >
          <p
            className={cn(
              'mb-3 text-sm font-bold uppercase tracking-wide',
              toneLabel[slide.tone]
            )}
          >
            {slide.uf}
          </p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-background/70 px-2 py-2.5">
              <p className="text-[10px] text-muted-foreground">Hoje</p>
              <p className="text-2xl font-bold tabular-nums">{nf.format(slide.today)}</p>
            </div>
            <div className="rounded-lg bg-background/70 px-2 py-2.5">
              <p className="text-[10px] text-muted-foreground">Semana</p>
              <p className="text-2xl font-bold tabular-nums">{nf.format(slide.week)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardTv({
  fullscreen = false,
  onEnterFullscreen,
  onExitFullscreen,
  drvagas = null,
}: Props) {
  const [weekBackend, setWeekBackend] = useState<WeekItem[]>([]);
  const [todayKpis, setTodayKpis] = useState({ entered: 0, left: 0, quit: 0 });
  const [hires, setHires] = useState<Hire[]>([]);
  const [hiresWeek, setHiresWeek] = useState<HiresWeekDay[]>([]);
  const [hiresToday, setHiresToday] = useState<HiresTodayAgg>({
    hiresTodayCE: 0,
    hiresTodayRN: 0,
    hiresTodayOutros: 0,
    processosPreenchidosHojeCE: 0,
    processosPreenchidosHojeRN: 0,
    processosPreenchidosHojeOutros: 0,
  });
  const [weeklyCE, setWeeklyCE] = useState<WeeklyState>(blankWeeklyState());
  const [weeklyRN, setWeeklyRN] = useState<WeeklyState>(blankWeeklyState());
  const [weeklyOutros, setWeeklyOutros] = useState<WeeklyState>(blankWeeklyState());
  const [outrosUFs, setOutrosUFs] = useState<Record<string, number>>({});
  const [dailyPills, setDailyPills] = useState({
    triados: 0,
    entrevista_online: 0,
    entrevista_presencial: 0,
    reprovados: 0,
    nao_compareceram: 0,
    aprovados: 0,
    contratados: 0,
    sem_status: 0,
  });
  const [totalContracts, setTotalContracts] = useState(0);
  const [showMonthlySummary, setShowMonthlySummary] = useState(false);
  const [refreshMin, setRefreshMin] = useState(() => readRefreshMin());
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const [loadSteps, setLoadSteps] = useState<LoadStep[]>([
    {
      id: 'dashboard',
      label: 'Dashboard & KPIs',
      description: 'estagiusplataform.com.br',
      status: 'pending',
    },
    {
      id: 'contratados',
      label: 'Contratados (Super Vagas)',
      description: 'apiminivagas.estagius.com.br',
      status: 'pending',
    },
    {
      id: 'movimentos',
      label: 'Movimentações do Dia',
      description: '7 endpoints de status',
      status: 'pending',
    },
    {
      id: 'contratos',
      label: 'Total de Contratos',
      description: 'estagiusplataform.com.br',
      status: 'pending',
    },
    {
      id: 'semanal',
      label: 'Resumo Semanal por UF',
      description: 'agrupando CE / RN / Outros',
      status: 'pending',
    },
  ]);

  const setStep = useCallback((id: string, status: LoadStepStatus) => {
    setLoadSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const resetSteps = useCallback(() => {
    setLoadSteps((prev) => prev.map((s) => ({ ...s, status: 'pending' as const })));
  }, []);

  const handleChangeRefreshMin = (min: number) => {
    writeRefreshMin(min);
    setRefreshMin(min);
  };

  const load = useCallback(async () => {
    const date = todayLocalISO();
    if (isFirstLoad.current) {
      setIsLoading(true);
      resetSteps();
    }
    try {
      setStep('dashboard', 'loading');
      setStep('contratados', 'loading');
      setStep('movimentos', 'loading');
      setStep('contratos', 'loading');
      setStep('semanal', 'loading');

      const [
        dash,
        hiresList,
        mvTriados,
        mvEntOnline,
        mvEntPresencial,
        mvReprovados,
        mvNaoCompareceram,
        mvAprovados,
        mvContratados,
        totalContractsValue,
      ] = await Promise.all([
        getDashboardTv(date).then((r) => {
          setStep('dashboard', 'done');
          return r;
        }),
        getContratados().then((r) => {
          setStep('contratados', 'done');
          return r;
        }),
        getCandidatesMovedTo('triados'),
        getCandidatesMovedTo('entrevista_online'),
        getCandidatesMovedTo('entrevista_presencial'),
        getCandidatesMovedTo('reprovados'),
        getCandidatesMovedTo('nao_compareceram'),
        getCandidatesMovedTo('aprovados'),
        getCandidatesMovedTo('contratados').then((r) => {
          setStep('movimentos', 'done');
          return r;
        }),
        getTotalContracts(date).then((r) => {
          setStep('contratos', 'done');
          return r;
        }),
      ]);

      const weeklyUF = await fetchWeeklyStatusByUFWithMoves({
        triados: mvTriados,
        entrevista_online: mvEntOnline,
        entrevista_presencial: mvEntPresencial,
        reprovados: mvReprovados,
        nao_compareceram: mvNaoCompareceram,
        aprovados: mvAprovados,
        contratados: mvContratados,
      });
      setStep('semanal', 'done');

      const today = dash?.today ?? {};
      const entered = Number(today?.contracts_created ?? 0);
      const left = Number(today?.contracts_shutdown ?? 0);
      let quit = Number(today?.contracts_shutdown_by_trainee ?? 0);

      if (!quit) {
        const list = Array.isArray(today?.shutdowns_by_reason)
          ? today.shutdowns_by_reason
          : [];
        const found = list.find((r) =>
          normText(r?.reason_shutdown || '').includes('iniciativa do estagiario')
        );
        quit = Number(found?.total ?? 0);
      }

      setTodayKpis({ entered, left, quit });
      setWeekBackend(Array.isArray(dash?.week) ? dash.week : []);
      setHires(hiresList || []);
      setHiresWeek(aggregateHiresWeek(hiresList || []));
      setHiresToday(aggregateHiresToday(hiresList || []));
      setDailyPills({
        triados: countMovedToday(mvTriados),
        entrevista_online: countMovedToday(mvEntOnline),
        entrevista_presencial: countMovedToday(mvEntPresencial),
        reprovados: countMovedToday(mvReprovados),
        nao_compareceram: countMovedToday(mvNaoCompareceram),
        aprovados: countMovedToday(mvAprovados),
        contratados: countMovedToday(mvContratados),
        sem_status: 0,
      });
      prefetchMonthlySummary(date, { preloadedHires: hiresList || [] });
      setWeeklyCE(weeklyUF.ce);
      setWeeklyRN(weeklyUF.rn);
      setWeeklyOutros(weeklyUF.outros);
      setOutrosUFs(weeklyUF.outrosUFs || {});
      setTotalContracts(totalContractsValue);
    } catch (e) {
      console.error(e);
      setLoadSteps((prev) =>
        prev.map((s) => (s.status === 'loading' ? { ...s, status: 'error' as const } : s))
      );
    } finally {
      if (isFirstLoad.current) {
        window.setTimeout(() => {
          setIsLoading(false);
          isFirstLoad.current = false;
        }, 600);
      }
    }
  }, [setStep, resetSteps]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), refreshMin * 60 * 1000);
    return () => window.clearInterval(id);
  }, [load, refreshMin]);

  const pillsItems = [
    { key: 'triados', label: 'Triados', value: dailyPills.triados, tone: 'blue' as const },
    {
      key: 'entrevista_online',
      label: 'Ent. Online',
      value: dailyPills.entrevista_online,
      tone: 'blue' as const,
    },
    {
      key: 'entrevista_presencial',
      label: 'Ent. Presencial',
      value: dailyPills.entrevista_presencial,
      tone: 'green' as const,
    },
    {
      key: 'reprovados',
      label: 'Reprovados',
      value: dailyPills.reprovados,
      tone: 'red' as const,
    },
    {
      key: 'nao_compareceram',
      label: 'Não Compareceram',
      value: dailyPills.nao_compareceram,
      tone: 'amber' as const,
    },
    {
      key: 'aprovados',
      label: 'Aprovados',
      value: dailyPills.aprovados,
      tone: 'green' as const,
    },
    {
      key: 'contratados',
      label: 'Contratados',
      value: dailyPills.contratados,
      tone: 'blue' as const,
    },
  ];

  const ufSlides = useMemo<UfSlide[]>(
    () => [
      {
        uf: 'CE',
        today: hiresToday.hiresTodayCE,
        week: (hiresWeek || []).reduce((acc, d) => acc + (d?.ce?.vagas || 0), 0),
        tone: 'green',
      },
      {
        uf: 'RN',
        today: hiresToday.hiresTodayRN,
        week: (hiresWeek || []).reduce((acc, d) => acc + (d?.rn?.vagas || 0), 0),
        tone: 'blue',
      },
      {
        uf: 'Outros',
        today: hiresToday.hiresTodayOutros,
        week: (hiresWeek || []).reduce((acc, d) => acc + (d?.outros?.vagas || 0), 0),
        tone: 'amber',
      },
    ],
    [hiresToday, hiresWeek]
  );

  const todayMessage = useMemo(() => getDashboardTvTodayMessage(), []);

  const shellClass = fullscreen
    ? 'fixed inset-0 z-[1200] flex flex-col gap-3 overflow-hidden bg-background p-4'
    : 'relative flex h-[calc(100vh-8rem)] min-h-[640px] flex-col gap-3 overflow-hidden';

  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExitFullscreen?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen, onExitFullscreen]);

  const pillToneClass: Record<KpiTone, string> = {
    blue: 'border-sky-200/70 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100',
    green:
      'border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    red: 'border-rose-200/70 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
    amber:
      'border-amber-200/70 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  };

  return (
    <div className={shellClass}>
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">Carregando Dashboard TV</CardTitle>
              <p className="text-sm text-muted-foreground">
                Atualização automática a cada {refreshMin} min
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {loadSteps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 rounded-lg border px-3 py-2"
                  >
                    <StepIcon status={step.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Intervalo de refresh</span>
                <Select
                  value={String(refreshMin)}
                  onValueChange={(v) => handleChangeRefreshMin(Number(v))}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFRESH_MIN_OPTIONS.map((min) => (
                      <SelectItem key={min} value={String(min)}>
                        {min} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar completa fora do fullscreen; no fullscreen frase + Música + Sair */}
      <div
        className={cn(
          'flex flex-shrink-0 flex-wrap items-center gap-2',
          fullscreen && 'gap-3'
        )}
      >
        {!fullscreen && (
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Dashboard TV
            </h2>
            <Badge
              variant="secondary"
              className="hidden border-sky-200/70 bg-sky-50 text-sky-700 sm:inline-flex dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
            >
              Auto {refreshMin} min
            </Badge>
          </div>
        )}

        <div className="min-w-0 flex-1 px-2 text-center">
          <p
            className={cn(
              'truncate font-semibold text-foreground',
              fullscreen ? 'text-base sm:text-xl md:text-2xl' : 'text-sm sm:text-base md:text-lg'
            )}
            title={todayMessage}
          >
            {todayMessage}
          </p>
        </div>

        {!fullscreen && (
          <>
            <Select
              value={String(refreshMin)}
              onValueChange={(v) => handleChangeRefreshMin(Number(v))}
            >
              <SelectTrigger className="h-9 w-[100px]">
                <SelectValue placeholder="Refresh" />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_MIN_OPTIONS.map((min) => (
                  <SelectItem key={min} value={String(min)}>
                    {min} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="size-4" />
              Atualizar
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMonthlySummary(true)}
            >
              Resumo mensal
            </Button>
          </>
        )}

        <DashboardTvMusicToggle
          playing={musicPlaying}
          onPlayingChange={setMusicPlaying}
        />

        {fullscreen ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onExitFullscreen}
          >
            <Minimize2 className="size-4" />
            Sair
          </Button>
        ) : (
          <Button type="button" variant="default" size="sm" onClick={onEnterFullscreen}>
            <Expand className="size-4" />
            Abrir fullscreen
          </Button>
        )}
      </div>

      <div className="grid flex-shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Total de Estagiários"
          value={totalContracts}
          icon={<Users className="size-4" />}
          tone="blue"
        />
        <KpiCard
          title="Entraram Hoje"
          value={todayKpis.entered}
          icon={<LogIn className="size-4" />}
          tone="green"
        />
        <KpiCard
          title="Saíram Hoje"
          value={todayKpis.left}
          icon={<LogOut className="size-4" />}
          tone="red"
        />
        <KpiCard
          title="Saídas por Iniciativa"
          value={todayKpis.quit}
          icon={<UserMinus className="size-4" />}
          tone="amber"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <Card className="flex-shrink-0">
            <CardContent className="flex flex-wrap gap-2 p-3">
              {pillsItems.map((item) => (
                <Badge
                  key={item.key}
                  variant="outline"
                  className={cn(
                    'gap-1.5 px-2.5 py-1 text-xs',
                    item.value > 0 ? pillToneClass[item.tone] : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                  <span className="tabular-nums font-bold">{nf.format(item.value)}</span>
                </Badge>
              ))}
            </CardContent>
          </Card>

          <div className="min-h-0 flex-1 overflow-hidden">
            <DashboardTvChartSwitcher
              week={weekBackend}
              hiresWeek={hiresWeek}
              weeklyCE={weeklyCE}
              weeklyRN={weeklyRN}
              weeklyOutros={weeklyOutros}
              outrosUFs={outrosUFs}
              rotateMs={45000}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <FilledPositionsSlider slides={ufSlides} rotateMs={20000} />

          <DashboardTvTopRanking
            bundle={drvagas}
            className="min-h-0 flex-[1.4] overflow-auto"
          />
        </div>
      </div>

      <DashboardTvMonthlyDialog
        open={showMonthlySummary}
        onOpenChange={setShowMonthlySummary}
        date={todayLocalISO()}
        preloadedHires={hires}
      />
    </div>
  );
}
