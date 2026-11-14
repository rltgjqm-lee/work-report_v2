import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";
import type { AdminSession } from "../types/admins";

export const getMe = () => request<AdminSession>("/api/me");

export const meKeys = {
  all: ["me"] as const,
};

// 세션이 없거나 만료됐으면 401이 나는 게 정상 상태라, 재시도 없이 한 번만 확인한다.
export const meQueryOptions = queryOptions({
  queryKey: meKeys.all,
  queryFn: getMe,
  retry: false,
});

const extendSession = () =>
  request<{ expiresAt: string }>("/api/me/extend-session", { method: "POST" });

// critical: 연장 성공 시 me 쿼리의 expiresAt을 갱신해야 AuthContext의 자동 로그아웃
// 타이머(expiresAt 기준)와 SessionExpiryBanner가 새 만료 시각을 바로 반영한다.
export const extendSessionMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: extendSession,
    onSuccess: (data) => {
      queryClient.setQueryData(meKeys.all, (current: AdminSession | null | undefined) =>
        current ? { ...current, expiresAt: data.expiresAt } : current,
      );
    },
  });

export const changeMyPassword = (currentPassword: string, newPassword: string) =>
  request<{ ok: true }>("/api/me/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

// 관리자 앱이 FCM 토큰을 등록한다(SOS 앱 알림). 같은 토큰이 다른 계정에 있었으면 이 계정으로 옮겨진다.
export const registerMyDevice = (fcmToken: string) =>
  request<{ ok: true }>("/api/me/devices", {
    method: "POST",
    body: JSON.stringify({ fcmToken }),
  });
