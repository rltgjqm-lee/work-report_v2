import { queryOptions } from "@tanstack/react-query";

import type { AdminSession } from "../../types/admins";

import { request } from "../client";

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

export const changeMyPassword = (currentPassword: string, newPassword: string) =>
  request<{ ok: true }>("/api/me/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
