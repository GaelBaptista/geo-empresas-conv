import axios from 'axios';
import { getAuthToken } from '@/lib/auth-storage';

const envBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const api = axios.create({
  baseURL: envBaseUrl || 'https://estagiusplataform.com.br',
});

let unauthorizedHandler: (() => void) | null = null;

/** Registra logout global para respostas 401. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  const token = getAuthToken() || (import.meta.env.VITE_API_TOKEN as string | undefined) || '';
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;
