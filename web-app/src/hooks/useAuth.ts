import { useCallback, useEffect, useState } from 'react';
import { getStoredToken, setStoredToken } from '../api/client';
import { getMe, type User } from '../api/auth';

type AuthState = {
  user: User | null;
  loading: boolean;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    if (!getStoredToken()) {
      setState({ user: null, loading: false });
      return;
    }
    getMe()
      .then((r) => setState({ user: r.user, loading: false }))
      .catch(() => {
        setStoredToken(null);
        setState({ user: null, loading: false });
      });
  }, []);

  const login = useCallback((token: string, user: User) => {
    setStoredToken(token);
    setState({ user, loading: false });
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setState({ user: null, loading: false });
  }, []);

  return { ...state, login, logout };
}
