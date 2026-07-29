import { useCallback, useMemo, useState } from 'react';
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  saveAuthToken,
  saveAuthUser,
  type AuthUser,
} from '@/lib/auth-storage';
import { loginWithCpf } from '@/services/authApi';

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } })
      .response;
    return (
      response?.data?.error ||
      response?.data?.message ||
      'CPF ou senha inválidos. Tente novamente.'
    );
  }
  return 'Não foi possível conectar à API. Verifique sua conexão.';
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getAuthUser());
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAuthenticated = Boolean(token);

  const signIn = useCallback(async (cpf: string, password: string) => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const res = await loginWithCpf(cpf, password);
      saveAuthToken(res.token);
      saveAuthUser(res.user);
      const raw = typeof res.token === 'string' ? res.token : res.token.token;
      setToken(raw);
      setUser(res.user);
    } catch (e) {
      clearAuthSession();
      setToken(null);
      setUser(null);
      setAuthError(extractErrorMessage(e));
      throw e;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(() => {
    clearAuthSession();
    setToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  return useMemo(
    () => ({
      user,
      token,
      isAuthenticated,
      isSigningIn,
      authError,
      setAuthError,
      signIn,
      signOut,
    }),
    [user, token, isAuthenticated, isSigningIn, authError, signIn, signOut]
  );
}
