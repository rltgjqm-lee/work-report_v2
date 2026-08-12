import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";
import { adminKeys } from "./admins";
import type { Program, ProgramWithParticipants } from "../../types/programs";

export const listPrograms = (organizationId?: number) =>
  request<Program[]>(`/api/programs${organizationId ? `?organizationId=${organizationId}` : ""}`);

export const programKeys = {
  all: ["programs"] as const,
  // "organization" 마커로 구분한다 — organizationId도 숫자라 detail(id)의 숫자와
  // 겹칠 수 있어서, 단순히 [...all, organizationId] 형태로 두면 우연히 같은 값일 때
  // 캐시 키가 충돌한다.
  byOrganization: (organizationId: number | undefined) =>
    [...programKeys.all, "organization", organizationId ?? "all"] as const,
  detail: (id: number) => [...programKeys.all, id] as const,
};

export const programsQueryOptions = queryOptions({
  queryKey: programKeys.all,
  queryFn: () => listPrograms(),
});

export const programsByOrganizationQueryOptions = (organizationId: number | undefined) =>
  queryOptions({
    queryKey: programKeys.byOrganization(organizationId),
    queryFn: () => listPrograms(organizationId),
  });

export const getProgram = (id: number) => request<ProgramWithParticipants>(`/api/programs/${id}`);

export const programQueryOptions = (id: number) =>
  queryOptions({
    queryKey: programKeys.detail(id),
    queryFn: () => getProgram(id),
  });

const createProgram = (data: Partial<Omit<Program, "id" | "createdAt">>) =>
  request<Program>("/api/programs", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createProgramMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: createProgram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: programKeys.all });
    },
  });

export interface UpdateProgramVariables {
  id: number;
  data: Partial<Omit<Program, "id" | "createdAt" | "organizationId">>;
}

const updateProgram = (id: number, data: UpdateProgramVariables["data"]) =>
  request<Program>(`/api/programs/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const updateProgramMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, data }: UpdateProgramVariables) => updateProgram(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: programKeys.all });
    },
  });

export interface SetProgramManagerVariables {
  programId: number;
  adminId: number | null;
}

// 사업단 담당자 지정
const setProgramManager = (programId: number, adminId: number | null) =>
  request<{ ok: true; adminId: number | null }>(`/api/programs/${programId}/manager`, {
    method: "PUT",
    body: JSON.stringify({ adminId }),
  });

export const setProgramManagerMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ programId, adminId }: SetProgramManagerVariables) =>
      setProgramManager(programId, adminId),
    onSuccess: () => {
      // 담당자 배정이 바뀌면 그 계정의 programIds도 같이 바뀐다 — 계정 목록도 무효화한다.
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
