import { getEstagius } from '@/lib/drvagas-api';
import {
  normalizeToArray,
  type Hire,
  type StatusKey,
} from '@/lib/dashboard-tv';

const statusRouteMap: Record<StatusKey, string> = {
  triados: 'triado',
  entrevista_online: 'entrevista_online',
  entrevista_presencial: 'entrevista_presencial',
  reprovados: 'reprovado',
  nao_compareceram: 'nao_compareceu',
  aprovados: 'aprovado',
  contratados: 'contratado',
};

export async function getContratados(): Promise<Hire[]> {
  const data = await getEstagius<unknown>('/candidatos/status/contratado');
  return normalizeToArray(data);
}

export async function getCandidatesMovedTo(key: StatusKey): Promise<Hire[]> {
  try {
    const slug = statusRouteMap[key];
    const data = await getEstagius<unknown>(`/candidatos/status/${slug}`);
    return normalizeToArray(data);
  } catch {
    return [];
  }
}

export async function getCandidatesByStatusWithDateRange(
  status: 'aprovado' | 'reprovado' | 'reprovado_empresa',
  startDate: string,
  endDate: string
): Promise<Hire[]> {
  try {
    const data = await getEstagius<unknown>(`/candidatos/status/${status}`, {
      start_date: startDate,
      end_date: endDate,
    });
    return normalizeToArray(data);
  } catch {
    return [];
  }
}
