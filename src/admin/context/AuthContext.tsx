import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { getMe, setOnUnauthorized } from "../api/client";
import { AuthContext, type AuthContextValue, type AuthState } from "./authContextInstance";

const initialState: AuthState = { admin: null, loading: true };

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>(initialState);

  // 세션 쿠키가 있으면 /api/me가 그 쿠키로 관리자 정보를 내려준다 — 없거나
  // 만료됐으면 401이 나고 아래 catch에서 admin: null로 처리된다.
  const refresh = useCallback(async () => {
    setAuthState((authState) => ({ ...authState, loading: true }));
    try {
      const admin = await getMe();
      setAuthState({ admin, loading: false });
    } catch {
      setAuthState({ admin: null, loading: false });
    }
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => setAuthState({ admin: null, loading: false }));

    let cancelled = false;
    getMe()
      .then((admin) => {
        if (!cancelled) setAuthState({ admin, loading: false });
      })
      .catch(() => {
        if (!cancelled) setAuthState({ admin: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 세션 만료 시각이 되면 다른 화면 조작 없이도 자동으로 로그아웃 처리한다 —
  // API 401을 다음 요청까지 기다리지 않고 그 순간 바로 세션을 정리한다.
  const expiresAt = authState.admin?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;

    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const timer = setTimeout(() => {
      setAuthState({ admin: null, loading: false });
      alert("세션이 만료되었습니다. 다시 로그인해주세요.");
    }, delay);

    return () => clearTimeout(timer);
  }, [expiresAt]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...authState, isAuthenticated: !!authState.admin, refresh }),
    [authState, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
