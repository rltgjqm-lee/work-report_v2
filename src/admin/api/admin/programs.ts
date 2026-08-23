import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type { Admin } from "../../types/admins";
import type { ProgramParticipant } from "../../types/participants";
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
  participants: (id: number) => [...programKeys.all, id, "participants"] as const,
  participantsByDemandSite: (id: number, demandSiteId: number | null) =>
    [...programKeys.participants(id), demandSiteId ?? "all"] as const,
  secondaryContactCandidates: (organizationId: number | undefined) =>
    [...programKeys.all, "secondary-contact-candidates", organizationId ?? "none"] as const,
  managerCandidates: (organizationId: number | undefined) =>
    [...programKeys.all, "manager-candidates", organizationId ?? "none"] as const,
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

// 사업단 수정 폼·breadcrumb용 — 참여자 목록(조인 필요) 없이 사업단 필드만 받는다.
const getProgramFields = (id: number) => request<Program>(`/api/programs/${id}/edit`);

export const programEditQueryOptions = (id: number) =>
  queryOptions({
    queryKey: programKeys.editDetail(id),
    queryFn: () => getProgramFields(id),
  });

// 근무 관리 화면 교육 탭의 "이수 등록" 모달 참여자 선택용 — GET /:id처럼 오늘 조
// 임시배정을 조인하지 않는 가벼운 참여자 목록만 받는다. demandSiteId를 주면 그
// 수요처 소속 참여자만 DB에서 걸러서 받는다.
const getProgramParticipants = (id: number, demandSiteId: number | null) => {
  const params = new URLSearchParams();
  if (demandSiteId) params.set("demandSiteId", String(demandSiteId));
  const query = params.toString();
  return request<ProgramParticipant[]>(
    `/api/programs/${id}/participants${query ? `?${query}` : ""}`,
  );
};

export const programParticipantsQueryOptions = (
  id: number,
  demandSiteId: number | null,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: programKeys.participantsByDemandSite(id, demandSiteId),
    queryFn: () => getProgramParticipants(id, demandSiteId),
    enabled,
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
  // 그 사업단 소속 수요처 담당자도 같이 바꿀지 — 기본값은 true(기존 동작과 동일).
  updateDemandSiteContacts?: boolean;
}

// 사업단 담당자 지정
const setProgramManager = (
  programId: number,
  adminId: number | null,
  updateDemandSiteContacts?: boolean,
) =>
  request<{ ok: true; adminId: number | null }>(`/api/programs/${programId}/manager`, {
    method: "PUT",
    body: JSON.stringify({ adminId, updateDemandSiteContacts }),
  });

export const setProgramManagerMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ programId, adminId, updateDemandSiteContacts }: SetProgramManagerVariables) =>
      setProgramManager(programId, adminId, updateDemandSiteContacts),
    onSuccess: () => {
      // 담당자 배정이 바뀌면 그 계정의 programIds도 같이 바뀐다 — 계정 목록도 무효화한다.
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });

// 보조 담당자(수요처 담당자 "+1")로 지정할 수 있는 계정 목록 — 계정 관리 화면과 달리
// 부관리자/담당자도 조회할 수 있고 id/이름만 내려온다. organizationId 기준이라
// 사업단 생성 시점(아직 id 없음)에도 쓸 수 있다 — managerCandidatesQueryOptions와
// 같은 organizationId를 그대로 넘기면 된다.
const listSecondaryContactCandidates = (organizationId: number | undefined) =>
  request<{ id: number; name: string | null }[]>(
    `/api/programs/secondary-contact-candidates${organizationId ? `?organizationId=${organizationId}` : ""}`,
  );

export const secondaryContactCandidatesQueryOptions = (organizationId: number | undefined) =>
  queryOptions({
    queryKey: programKeys.secondaryContactCandidates(organizationId),
    queryFn: () => listSecondaryContactCandidates(organizationId),
    enabled: organizationId !== undefined,
  });

// 사업단 담당자로 지정할 수 있는 계정(담당자/부관리자) 목록 — 계정 관리 화면과 달리
// 부관리자/담당자 본인도 조회할 수 있다. organizationId는 SUPER_ADMIN이 사업단을
// 새로 만들 때 고른 기관을 넘길 때만 쓰고, 그 외 역할은 서버가 자기 기관으로 고정한다.
type ManagerCandidate = Pick<Admin, "id" | "name" | "email" | "role" | "programIds">;

const listManagerCandidates = (organizationId: number | undefined) =>
  request<ManagerCandidate[]>(
    `/api/programs/manager-candidates${organizationId ? `?organizationId=${organizationId}` : ""}`,
  );

// SUPER_ADMIN이 아직 기관을 안 고른 상태(organizationId undefined)에서도 호출부가
// 매번 조건 분기하지 않도록 enabled를 팩토리 안에서 계산한다.
export const managerCandidatesQueryOptions = (organizationId: number | undefined) =>
  queryOptions({
    queryKey: programKeys.managerCandidates(organizationId),
    queryFn: () => listManagerCandidates(organizationId),
    enabled: organizationId !== undefined,
  });
