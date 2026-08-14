import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { meKeys, meQueryOptions } from "../api/admin/me";
import { setOnUnauthorized } from "../api/client";
import { AuthContext, type AuthContextValue } from "./authContextInstance";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();

  // 세션 쿠키가 있으면 /api/me가 그 쿠키로 관리자 정보를 내려준다 — 없거나
  // 만료됐으면 401이 나고 admin은 null로 취급한다(meQueryOptions가 재시도는 안 함).
  const { data: admin, isLoading, refetch } = useQuery(meQueryOptions);

  useEffect(() => {
    // 다른 API 호출이 401을 받으면 그 순간 바로 세션을 비운다 — 다음 /api/me
    // 재조회를 기다리지 않는다.
    setOnUnauthorized(() => queryClient.setQueryData(meKeys.all, null));
  }, [queryClient]);

  // 세션 만료 시각이 되면 다른 화면 조작 없이도 자동으로 로그아웃 처리한다 —
  // API 401을 다음 요청까지 기다리지 않고 그 순간 바로 세션을 정리한다.
  const expiresAt = admin?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;

    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const timer = setTimeout(() => {
      queryClient.setQueryData(meKeys.all, null);
      alert("세션이 만료되었습니다. 다시 로그인해주세요.");
    }, delay);

    return () => clearTimeout(timer);
  }, [expiresAt, queryClient]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value = useMemo<AuthContextValue>(
    () => ({ admin: admin ?? null, loading: isLoading, isAuthenticated: !!admin, refresh }),
    [admin, isLoading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
