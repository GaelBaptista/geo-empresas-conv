import { api } from '@/lib/api';
import type { ApiGroupOption, ApiListResponse } from '@/types/api';

export type GroupOption = {
  id: number;
  label: string;
};

function unwrapList<T>(payload: ApiListResponse<T>): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function fetchGroupOptions(): Promise<GroupOption[]> {
  const { data } = await api.get<ApiListResponse<ApiGroupOption>>('/groups/options');
  return unwrapList(data)
    .map((item) => ({
      id: Number(item.value),
      label: String(item.label || '').trim(),
    }))
    .filter((item) => Number.isFinite(item.id) && item.label)
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}
