import { queryOptions } from "@tanstack/react-query";

import { request } from "../client";

export type LoginHistoryEntry = {
  id: number;
  email: string;
  adminName: string | null;
  success: boolean;
  ipAddress: string | null;
  createdAt: string;
};

export const listLoginHistory = () =>
  request<LoginHistoryEntry[]>("/api/admins/login-history");

export const loginHistoryKeys = {
  all: ["login-history"] as const,
};

export const loginHistoryQueryOptions = queryOptions({
  queryKey: loginHistoryKeys.all,
  queryFn: listLoginHistory,
});
