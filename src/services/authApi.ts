import { api } from '@/lib/api';
import type { AuthUser } from '@/lib/auth-storage';

export type LoginResponse = {
  token: string | { token: string; type?: string; refreshToken?: string };
  user: AuthUser;
};

export async function loginWithCpf(cpf: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/sessions', { cpf, password });
  return data;
}
