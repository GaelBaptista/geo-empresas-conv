import api from '@/lib/api';

export type WeekItem = {
  day: string;
  entered: number;
  left: number;
  quit: number;
};

export type StateItem = { name: string; value: number };

export type DashboardTvToday = {
  contracts_created?: number | string;
  contracts_shutdown?: number | string;
  contracts_shutdown_by_trainee?: number | string;
  shutdowns_by_reason?: { reason_shutdown: string; total: number | string }[];
};

export type DashboardTvData = {
  date: string;
  today: DashboardTvToday;
  yesterday?: DashboardTvToday;
  month?: {
    trainees_by_state?: StateItem[];
    companies_by_state?: StateItem[];
    trainees_total_month?: number;
  };
  week?: WeekItem[];
  categories_companies_actives?: {
    '5': number;
    '10': number;
    '15': number;
    '20': number;
    '20+': number;
  };
};

export async function getDashboardTv(dateISO: string): Promise<DashboardTvData> {
  const { data } = await api.get<DashboardTvData>(`/dashboard-tv?date=${dateISO}`);
  return data;
}

export async function getTotalContracts(dateISO: string): Promise<number> {
  const d = new Date(dateISO);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const { data } = await api.get<{ total_contracts?: number }>(
    `dashboard?year=${year}&month=${month}`
  );
  return Number(data.total_contracts ?? 0);
}

export async function getMonthlyDashboard(year: number): Promise<unknown> {
  const { data } = await api.get(`/dashboard?year=${year}`);
  return data;
}

export async function getContractsFallback(): Promise<unknown[]> {
  try {
    const { data } = await api.get(`contracts`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
