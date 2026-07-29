const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export type AuthUser = {
  id: number;
  name: string;
  company_id: number | null;
  trainee_id: number | null;
  teacher_id?: number | null;
  application_id: number | null;
  application_name: string | null;
  financial_access: boolean;
};

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveAuthToken(raw: string | { token: string }): void {
  const value = typeof raw === 'string' ? raw : raw.token;
  localStorage.setItem(TOKEN_KEY, value);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveAuthUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function clearAuthSession(): void {
  clearAuthToken();
  clearAuthUser();
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}
