import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { LOCAL_STORAGE_KEYS } from "../../constants/storage";
import { login as loginRequest, setOnUnauthorized } from "../api/client";
import { decodeJwtPayload } from "../lib/jwt";
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from "./authContextInstance";

const emptyState: AuthState = {
  token: null,
  username: null,
  role: null,
  organizationId: null,
};

const buildStateFromToken = (token: string | null): AuthState => {
  if (!token) return emptyState;
  const payload = decodeJwtPayload(token);
  if (!payload) return emptyState;
  return {
    token,
    username: payload.username,
    role: payload.role,
    organizationId: payload.organizationId,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>(() =>
    buildStateFromToken(localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_JWT)),
  );

  const logout = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ADMIN_JWT);
    setState(emptyState);
  }, []);

  useEffect(() => {
    setOnUnauthorized(logout);
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const { token } = await loginRequest(username, password);
    localStorage.setItem(LOCAL_STORAGE_KEYS.ADMIN_JWT, token);
    setState(buildStateFromToken(token));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, isAuthenticated: !!state.token, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
