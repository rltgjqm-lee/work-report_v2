import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type {
  Program,
  ProgramFilterOption,
  ProgramListItem,
  ProgramOption,
  ProgramWithParticipants,
} from "../../types/programs";

import { request } from "../client";
import { adminKeys } from "./admins";

const listPrograms = (organizationId?: number) =>
  request<Program[]>(`/api/programs${organizationId ? `?organizationId=${organizationId}` : ""}`);

// 사업단 관리 목록 화면 전용 — 참여자 수·소속 기관명·담당자명까지 서버에서 조합해 내려준다.
const listProgramsSummary = (organizationId?: number) =>
  request<ProgramListItem[]>(
    `/api/programs/summary${organizationId ? `?organizationId=${organizationId}` : ""}`,
  );

export const programKeys = {
  all: ["programs"] as const,
  // "organization" 마커로 구분한다 — organizationId도 숫자라 detail(id)의 숫자와
  // 겹칠 수 있어서, 단순히 [...all, organizationId] 형태로 두면 우연히 같은 값일 때
  // 캐시 키가 충돌한다.
  byOrganization: (organizationId: number | undefined) =>
    [...programKeys.all, "organization", organizationId ?? "all"] as const,
  byOrganizationOptions: (organizationId: number | undefined) =>
    [...programKeys.all, "organization-options", organizationId ?? "all"] as const,
  detail: (id: number) => [...programKeys.all, id] as const,
  editDetail: (id: number) => [...programKeys.all, id, "edit"] as const,
};

// 유형 필터가 있는 드롭다운용 — 여러 화면이 같이 쓰므로 이름/유형까지만 받는다.
export const programsQueryOptions = queryOptions({
  queryKey: programKeys.all,
  queryFn: () => listPrograms(),
  select: (programs): ProgramFilterOption[] =>
    programs.map((program) => ({
      id: program.id,
      name: program.name,
      programType: program.programType,
    })),
});

// 사업단 관리 목록 화면용 — 급여 관련 필드는 빼고 화면에 보여주는 필드 + 참여자 수·
// 소속 기관명·담당자명을 받는다.
export const programsByOrganizationQueryOptions = (organizationId: number | undefined) =>
  queryOptions({
    queryKey: programKeys.byOrganization(organizationId),
    queryFn: () => listProgramsSummary(organizationId),
  });

// 이름만 필요한 드롭다운용(담당자 이관 모달 등).
export const programOptionsByOrganizationQueryOptions = (organizationId: number | undefined) =>
  queryOptions({
    queryKey: programKeys.byOrganizationOptions(organizationId),
    queryFn: () => listPrograms(organizationId),
    select: (programs): ProgramOption[] =>
      programs.map((program) => ({ id: program.id, name: program.name })),
  });

const getProgram = (id: number) => request<ProgramWithParticipants>(`/api/programs/${id}`);

export const programQueryOptions = (id: number) =>
  queryOptions({
    queryKey: programKeys.detail(id),
    queryFn: () => getProgram(id),
  });

// 사업단 수정 폼용 — 참여자 목록(조인 필요) 없이 사업단 필드만 받는다.
const getProgramFields = (id: number) =>
  request<Program>(`/api/programs/${id}?withParticipants=false`);

export const programEditQueryOptions = (id: number) =>
  queryOptions({
    queryKey: programKeys.editDetail(id),
    queryFn: () => getProgramFields(id),
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
