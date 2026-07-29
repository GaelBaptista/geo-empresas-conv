import { api } from '@/lib/api';
import type { ApiActiveContract, ApiListResponse } from '@/types/api';

function unwrapList<T>(payload: ApiListResponse<T>): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function fetchActiveContracts(): Promise<ApiActiveContract[]> {
  const { data } = await api.get<ApiListResponse<ApiActiveContract>>(
    '/apprentice-contracts/active'
  );
  return unwrapList(data);
}

/** Conta contratos ativos por company_id da API. */
export function countActiveTraineesByCompany(
  contracts: ApiActiveContract[]
): Map<number, number> {
  const counts = new Map<number, number>();
  contracts.forEach((contract) => {
    if (contract.status === false) return;
    const companyId = Number(contract.company_id);
    if (!Number.isFinite(companyId)) return;
    counts.set(companyId, (counts.get(companyId) || 0) + 1);
  });
  return counts;
}
