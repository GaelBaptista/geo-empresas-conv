import {
  getContractsFallback,
  getMonthlyDashboard,
} from '@/services/dashboardTvApi';
import {
  getCandidatesByStatusWithDateRange,
  getContratados,
} from '@/services/dashboardTvStatusApi';
import {
  getHireDateISO,
  getMonthEnd,
  getMonthStart,
  getStateFromHire,
  isInMonth,
  normText,
  pickMovementISO,
  toISODateOnly,
  type Hire,
} from '@/lib/dashboard-tv';

const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

type SummaryCacheEntry = {
  expiresAt: number;
  data?: MonthlySummaryData;
  promise?: Promise<MonthlySummaryData>;
};

const summaryCache = new Map<string, SummaryCacheEntry>();

export type MonthlySummaryOptions = {
  preloadedHires?: Hire[];
};

export type MonthlySummaryData = {
  entered: number;
  left: number;
  leftByTraineeInitiative: number;
  filledPositions: number;
  filledPositionsByUF: {
    ce: number;
    rn: number;
    outros: number;
    outrosByState: Record<string, number>;
  };
  status: {
    aprovados: number;
    reprovados: number;
    contratados: number;
    reprovadosEmpresa: number;
    aprovadosEmpresa: number;
    contratadosEmpresa: number;
  };
  reprovadosEmpresaByCompany: Record<string, number>;
  aprovadosByCompany: Record<string, number>;
  contratadosByCompany: Record<string, number>;
};

function getSummaryCacheKey(dateISO: string): string {
  const d = new Date(dateISO);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function prefetchMonthlySummary(
  dateISO: string,
  options?: MonthlySummaryOptions
): void {
  void getMonthlySummary(dateISO, options).catch(() => {});
}

async function buildMonthlySummary(
  dateISO: string,
  options?: MonthlySummaryOptions
): Promise<MonthlySummaryData> {
  const d = new Date(dateISO);
  const year = d.getFullYear();
  const monthNumber = d.getMonth() + 1;
  const monthStart = getMonthStart(dateISO);
  const monthEnd = getMonthEnd(dateISO);

  const hiresPromise = options?.preloadedHires
    ? Promise.resolve(options.preloadedHires)
    : getContratados();

  const [
    dashboardResponse,
    hires,
    aprovadosList,
    reprovadosList,
    reprovadosEmpresaList,
  ] = await Promise.all([
    getMonthlyDashboard(year),
    hiresPromise,
    getCandidatesByStatusWithDateRange('aprovado', monthStart, monthEnd),
    getCandidatesByStatusWithDateRange('reprovado', monthStart, monthEnd),
    getCandidatesByStatusWithDateRange('reprovado_empresa', monthStart, monthEnd),
  ]);

  const dash = dashboardResponse as {
    monthly_data?: Array<{
      month?: number;
      actives_contracts?: number;
      shutdown_contracts?: number;
      groups_reasons_shutdowns?: Array<{ reason_shutdown?: string; qtd?: number }>;
    }>;
  };

  const monthlyData = Array.isArray(dash?.monthly_data)
    ? dash.monthly_data.find((m) => Number(m?.month) === monthNumber)
    : null;

  const needsContractsFallback =
    !monthlyData ||
    monthlyData.actives_contracts === undefined ||
    monthlyData.shutdown_contracts === undefined ||
    !monthlyData.groups_reasons_shutdowns;

  const contractsResponse = needsContractsFallback
    ? await getContractsFallback()
    : [];

  const contracts = Array.isArray(contractsResponse) ? contractsResponse : [];

  const enteredInMonth = contracts.filter((contract) => {
    const c = contract as { start_validity?: string };
    if (!c?.start_validity) return false;
    const startDate = toISODateOnly(c.start_validity);
    return isInMonth(startDate, monthStart, monthEnd);
  }).length;

  const entered =
    monthlyData?.actives_contracts !== undefined
      ? Number(monthlyData.actives_contracts)
      : enteredInMonth;

  const leftInMonth = contracts.filter((contract) => {
    const c = contract as { date_shutdown?: string };
    if (!c?.date_shutdown) return false;
    const shutdownDate = toISODateOnly(c.date_shutdown);
    return isInMonth(shutdownDate, monthStart, monthEnd);
  }).length;

  const left =
    monthlyData?.shutdown_contracts !== undefined
      ? Number(monthlyData.shutdown_contracts)
      : leftInMonth;

  let leftByTraineeInitiative = 0;
  if (monthlyData?.groups_reasons_shutdowns) {
    const shutdownReasons = Array.isArray(monthlyData.groups_reasons_shutdowns)
      ? monthlyData.groups_reasons_shutdowns
      : [];
    const traineeInitiativeReason = shutdownReasons.find((r) =>
      normText(r?.reason_shutdown || '').includes('iniciativa do estagiario')
    );
    leftByTraineeInitiative = Number(traineeInitiativeReason?.qtd ?? 0);
  } else {
    const shutdownsInMonth = contracts.filter((contract) => {
      const c = contract as { date_shutdown?: string };
      if (!c?.date_shutdown) return false;
      const shutdownDate = toISODateOnly(c.date_shutdown);
      return isInMonth(shutdownDate, monthStart, monthEnd);
    });
    leftByTraineeInitiative = shutdownsInMonth.filter((contract) => {
      const c = contract as { reason_shutdown?: string };
      return normText(c?.reason_shutdown || '').includes('iniciativa do estagiario');
    }).length;
  }

  const onlyHired = (hires || []).filter(
    (h) => String(h?.status).toLowerCase() === 'contratado'
  );

  const hiresInMonth = onlyHired.filter((h) => {
    const hireDate = getHireDateISO(h);
    return isInMonth(hireDate, monthStart, monthEnd);
  });

  const filledPositions = hiresInMonth.length;
  const outrosHires = hiresInMonth.filter((h) => getStateFromHire(h) === 'outros');

  const outrosByState: Record<string, number> = {};
  outrosHires.forEach((h) => {
    const posting = h?.job_posting as { estado?: string } | undefined;
    const rawState =
      (h?.address_state as string | undefined) ||
      (h?.estado as string | undefined) ||
      (h?.state as string | undefined) ||
      (h?.company as { state?: string } | undefined)?.state ||
      (h?.empresa as { estado?: string } | undefined)?.estado ||
      posting?.estado ||
      'Não informado';
    const stateName = String(rawState).trim() || 'Não informado';
    outrosByState[stateName] = (outrosByState[stateName] || 0) + 1;
  });

  const filledPositionsByUF = {
    ce: hiresInMonth.filter((h) => getStateFromHire(h) === 'ce').length,
    rn: hiresInMonth.filter((h) => getStateFromHire(h) === 'rn').length,
    outros: outrosHires.length,
    outrosByState,
  };

  const filterByMonth = (items: Hire[]) =>
    (items || []).filter((x) => {
      const movedDate = toISODateOnly(pickMovementISO(x));
      return isInMonth(movedDate, monthStart, monthEnd);
    });

  const aprovadosInMonth = filterByMonth(aprovadosList);
  const reprovadosInMonth = filterByMonth(reprovadosList);
  const reprovadosEmpresaInMonth = filterByMonth(reprovadosEmpresaList);
  const contratadosInMonth = filterByMonth(hires);

  const companyNameOf = (item: Hire) => {
    const posting = item?.job_posting as
      | { company_name?: string; empresa?: string }
      | undefined;
    return (
      posting?.company_name ||
      posting?.empresa ||
      (item?.empresa as string | undefined) ||
      'Empresa não informada'
    );
  };

  const groupByCompany = (items: Hire[]) => {
    const map: Record<string, number> = {};
    items.forEach((item) => {
      const key = String(companyNameOf(item)).trim() || 'Empresa não informada';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  };

  return {
    entered,
    left,
    leftByTraineeInitiative,
    filledPositions,
    filledPositionsByUF,
    status: {
      aprovados: aprovadosInMonth.length,
      reprovados: reprovadosInMonth.length,
      contratados: contratadosInMonth.length,
      reprovadosEmpresa: reprovadosEmpresaInMonth.length,
      aprovadosEmpresa: aprovadosInMonth.length,
      contratadosEmpresa: contratadosInMonth.length,
    },
    reprovadosEmpresaByCompany: groupByCompany(reprovadosEmpresaInMonth),
    aprovadosByCompany: groupByCompany(aprovadosInMonth),
    contratadosByCompany: groupByCompany(contratadosInMonth),
  };
}

export async function getMonthlySummary(
  dateISO: string,
  options?: MonthlySummaryOptions
): Promise<MonthlySummaryData> {
  const cacheKey = getSummaryCacheKey(dateISO);
  const now = Date.now();
  const cached = summaryCache.get(cacheKey);

  if (cached?.data && cached.expiresAt > now) {
    return cached.data;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = buildMonthlySummary(dateISO, options)
    .then((data) => {
      summaryCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
      });
      return data;
    })
    .catch((error) => {
      summaryCache.delete(cacheKey);
      throw error;
    });

  summaryCache.set(cacheKey, {
    promise,
    expiresAt: now + SUMMARY_CACHE_TTL_MS,
  });

  return promise;
}
