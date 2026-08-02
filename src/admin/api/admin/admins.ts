import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";
import type { Admin, Role } from "../../types";

interface CreateAdminVariables {
  email: string;
  name: string;
  role: Role;
  organizationId?: number;
  programIds?: number[];
  groupIds?: number[];
  password: string;
}
interface UpdateAdminVariables {
  id: number;
  data: Partial<{
    name: string;
    role: Role;
    programIds: number[];
    groupIds: number[];
    isActive: boolean;
  }>;
}
export interface ProgramManagerAssignment {
  programId: number;
  toAdminId: number;
}
interface TransferAdminProgramsVariables {
  id: number;
  assignments: ProgramManagerAssignment[];
}

export const adminKeys = {
  all: ["admins"] as const,
};

export const listAdmins = () => request<Admin[]>("/api/admins");

export const adminsQueryOptions = queryOptions({
  queryKey: adminKeys.all,
  queryFn: listAdmins,
});

const createAdmin = (data: CreateAdminVariables) =>
  request<Admin>("/api/admins", {
    method: "POST",
    body: JSON.stringify(data),
  });

// critical: 계정 생성/수정/이관에서 호출시 계정 목록을 무효화해야 한다.
export const createAdminMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: createAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });

const updateAdmin = (id: number, data: UpdateAdminVariables["data"]) =>
  request<Admin>(`/api/admins/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const updateAdminMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, data }: UpdateAdminVariables) => updateAdmin(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });

// 담당 이관 — 담당 사업단을 사업단별로 다른 담당자에게 나눠서(또는 한 사람에게 몰아서) 넘기고,
// 그 사업단의 수요처 담당자도 함께 바꾼다
const transferAdminPrograms = (id: number, assignments: ProgramManagerAssignment[]) =>
  request<{ ok: true; programCount: number; demandSiteCount: number }>(
    `/api/admins/${id}/transfer-programs`,
    { method: "PUT", body: JSON.stringify({ assignments }) },
  );

export const transferAdminProgramsMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, assignments }: TransferAdminProgramsVariables) =>
      transferAdminPrograms(id, assignments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });

export const resetAdminPassword = (id: number, newPassword: string) =>
  request<{ ok: true }>(`/api/admins/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ newPassword }),
  });
