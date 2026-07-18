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

  // 로그인 자체는 Cloudflare Access(이메일 OTP)가 이 앱 앞단에서 처리한다.
  // 여기서는 그 인증이 끝난 뒤 /api/me로 "이 이메일이 admins에 등록돼 있는지"만 확인한다.
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
