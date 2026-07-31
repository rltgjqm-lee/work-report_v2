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
