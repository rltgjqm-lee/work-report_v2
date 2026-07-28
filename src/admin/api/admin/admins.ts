import { request } from "../client";
import type { Admin, Role } from "../../types";

export const listAdmins = () => request<Admin[]>("/api/admins");

export const createAdmin = (data: {
  email: string;
  name: string;
  role: Role;
  organizationId?: number;
  programIds?: number[];
  groupIds?: number[];
  password: string;
}) =>
  request<Admin>("/api/admins", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateAdmin = (
  id: number,
  data: Partial<{
    name: string;
    role: Role;
    programIds: number[];
    groupIds: number[];
    isActive: boolean;
  }>,
) =>
  request<Admin>(`/api/admins/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// 담당 이관 — 담당 사업단 전부를 다른 담당자에게 넘기고, 그 사업단의 수요처 담당자도 함께 바꾼다
export const transferAdminPrograms = (id: number, toAdminId: number) =>
  request<{ ok: true; programCount: number; demandSiteCount: number }>(
    `/api/admins/${id}/transfer-programs`,
    { method: "PUT", body: JSON.stringify({ toAdminId }) },
  );

export const resetAdminPassword = (id: number, newPassword: string) =>
  request<{ ok: true }>(`/api/admins/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ newPassword }),
  });
