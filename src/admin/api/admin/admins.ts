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

export const resetAdminPassword = (id: number, newPassword: string) =>
  request<{ ok: true }>(`/api/admins/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ newPassword }),
  });
