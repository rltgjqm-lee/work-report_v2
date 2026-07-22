import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getMe, setOnUnauthorized } from "../api/client";
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from "./authContextInstance";

const initialState: AuthState = { admin: null, loading: true };

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>(initialState);

  // 세션 쿠키가 있으면 /api/me가 그 쿠키로 관리자 정보를 내려준다 — 없거나
  // 만료됐으면 401이 나고 아래 catch에서 admin: null로 처리된다.
  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const admin = await getMe();
      setState({ admin, loading: false });
    } catch {
      setState({ admin: null, loading: false });
    }
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => setState({ admin: null, loading: false }));

    let cancelled = false;
    getMe()
      .then((admin) => {
        if (!cancelled) setState({ admin, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ admin: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, isAuthenticated: !!state.admin, refresh }),
    [state, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
