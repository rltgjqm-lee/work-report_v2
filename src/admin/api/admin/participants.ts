import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";
import { programKeys } from "./programs";
import { groupKeys } from "./groups";
import type {
  AnnualLeave,
  LeaveType,
  Participant,
  ParticipantDetail,
  ParticipantLeave,
  ParticipantMonthlyAttendance,
} from "../../types";

export const participantKeys = {
  all: ["participants"] as const,
  detail: (id: number) => [...participantKeys.all, id] as const,
  attendance: (id: number, month: string) =>
    [...participantKeys.detail(id), "attendance", month] as const,
  leaves: (id: number) => [...participantKeys.detail(id), "leaves"] as const,
  annualLeave: (id: number, year: string) =>
    [...participantKeys.detail(id), "annual-leave", year] as const,
  groupOverrides: (id: number) => [...participantKeys.detail(id), "group-overrides"] as const,
};

export const getParticipant = (id: number) => request<ParticipantDetail>(`/api/participants/${id}`);

export const participantQueryOptions = (id: number) =>
  queryOptions({
    queryKey: participantKeys.detail(id),
    queryFn: () => getParticipant(id),
  });

export const getParticipantAttendance = (id: number, month: string) =>
  request<ParticipantMonthlyAttendance>(`/api/participants/${id}/attendance?month=${month}`);

export const participantAttendanceQueryOptions = (id: number, month: string) =>
  queryOptions({
    queryKey: participantKeys.attendance(id, month),
    queryFn: () => getParticipantAttendance(id, month),
  });

export const getParticipantLeaves = (id: number) =>
  request<ParticipantLeave[]>(`/api/participants/${id}/leaves`);

export const participantLeavesQueryOptions = (id: number) =>
  queryOptions({
    queryKey: participantKeys.leaves(id),
    queryFn: () => getParticipantLeaves(id),
  });

export interface AddParticipantVariables {
  programId: number;
  data: {
    name: string;
    gender: "남성" | "여성";
    demandSiteId?: number;
    groupId?: number;
    birthYear?: number;
  };
}

export const addParticipant = (programId: number, data: AddParticipantVariables["data"]) =>
  request<Participant>(`/api/programs/${programId}/participants`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// critical: 새 참여자가 사업단 참여자 목록(programKeys.detail)에 들어가고, 조에 배정됐다면
// 그 조의 participantCount도 바뀐다.
export const addParticipantMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ programId, data }: AddParticipantVariables) => addParticipant(programId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: programKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

export const deleteParticipant = (programId: number, participantId: number) =>
  request<{ success: boolean }>(`/api/programs/${programId}/participants/${participantId}`, {
    method: "DELETE",
  });

export interface DeleteParticipantVariables {
  programId: number;
  participantId: number;
  name: string;
}

// 삭제 성공 시 그 참여자가 속한 사업단의 상세(참여자 목록 포함)만 무효화한다 — 이건 어느
// 화면에서 호출하든 항상 해야 하는 "critical" 부분이라 여기 둔다. 삭제 완료를 어떻게
// 알려줄지(alert 문구 등)는 화면마다 다른 "UI 한정" 부분이라 호출부의 mutate(variables,
// { onSuccess, onError })에서 처리한다.
export const deleteParticipantMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ programId, participantId }: DeleteParticipantVariables) =>
      deleteParticipant(programId, participantId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: programKeys.detail(variables.programId),
      });
      // 삭제된 참여자가 조에 배정돼 있었다면 그 조의 participantCount도 바뀐다.
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

export interface BulkAddParticipantsVariables {
  programId: number;
  data: {
    participants: {
      name: string;
      gender: "남성" | "여성";
      demandSiteId?: number;
      groupId?: number;
    }[];
  };
}

export const bulkAddParticipants = (
  programId: number,
  data: BulkAddParticipantsVariables["data"],
) =>
  request<Participant[]>(`/api/programs/${programId}/participants/bulk`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const bulkAddParticipantsMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ programId, data }: BulkAddParticipantsVariables) =>
      bulkAddParticipants(programId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: programKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

export interface UpdateParticipantVariables {
  id: number;
  data: Partial<
    Pick<
      Participant,
      | "name"
      | "demandName"
      | "demandSiteId"
      | "birthYear"
      | "groupId"
      | "hourlyWage"
      | "educationAmount"
      | "educationType"
      | "dementiaAmount"
      | "dementiaType"
      | "healthInsuranceEnrolled"
      | "longtermCareInsuranceEnrolled"
      | "employmentInsuranceEnrolled"
      | "industrialAccidentInsuranceEnrolled"
      | "weeklyHolidayHours"
    >
  >;
}

export const updateParticipant = (id: number, data: UpdateParticipantVariables["data"]) =>
  request<Participant>(`/api/participants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// critical: 방금 수정한 필드를 참여자 상세 쿼리 캐시에 바로 반영한다 — 다시 불러오지
// 않아도 상세 화면이 최신 상태를 보여준다. 모달 닫기 같은 UI 한정 동작은 호출부의
// mutate(variables, { onSuccess, onError })에 둔다.
export const updateParticipantMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, data }: UpdateParticipantVariables) => updateParticipant(id, data),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(
        participantKeys.detail(variables.id),
        (previous: ParticipantDetail | undefined) =>
          previous ? { ...previous, ...updated } : previous,
      );
    },
  });

// 아래 참여자 상태/조 배정 뮤테이션들은 모두 조의 participantCount(활성 인원만 셈)에도
// 영향을 줄 수 있어 programKeys.detail과 groupKeys.byProgram을 같이 무효화한다.
// programId는 서버로 보내는 값이 아니라 이 무효화 대상을 찾기 위한 변수다.

export interface MoveParticipantToGroupVariables {
  participantId: number;
  programId: number;
  groupId: number;
}

export const moveParticipantToGroup = (id: number, groupId: number) =>
  request<Participant>(`/api/participants/${id}/group`, {
    method: "POST",
    body: JSON.stringify({ groupId }),
  });

export const moveParticipantToGroupMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ participantId, groupId }: MoveParticipantToGroupVariables) =>
      moveParticipantToGroup(participantId, groupId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: programKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

// 특정 날짜만 다른 조로 취급하는 임시 배정 이력 — 원래 조(participants.groupId)는 그대로 두고
// 그날의 출퇴근 시간/근무일 판정에서만 이 조를 우선 적용한다.
export interface ParticipantGroupOverride {
  override: {
    id: number;
    participantId: number;
    date: string;
    groupId: number;
    createdBy: number;
    createdAt: string;
  };
  groupName: string;
}

export const getParticipantGroupOverrides = (id: number) =>
  request<ParticipantGroupOverride[]>(`/api/participants/${id}/group-overrides`);

export const participantGroupOverridesQueryOptions = (id: number) =>
  queryOptions({
    queryKey: participantKeys.groupOverrides(id),
    queryFn: () => getParticipantGroupOverrides(id),
  });

export interface SetParticipantGroupOverrideVariables {
  participantId: number;
  date: string;
  groupId: number;
}

export const setParticipantGroupOverride = (id: number, date: string, groupId: number) =>
  request<ParticipantGroupOverride["override"]>(`/api/participants/${id}/group-overrides`, {
    method: "POST",
    body: JSON.stringify({ date, groupId }),
  });

// critical: 이 참여자의 임시 배정 목록 캐시를 무효화한다 — 어느 화면에서 등록하든 항상 필요.
export const setParticipantGroupOverrideMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ participantId, date, groupId }: SetParticipantGroupOverrideVariables) =>
      setParticipantGroupOverride(participantId, date, groupId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: participantKeys.groupOverrides(variables.participantId),
      });
    },
  });

export interface DeleteParticipantGroupOverrideVariables {
  participantId: number;
  date: string;
}

export const deleteParticipantGroupOverride = (id: number, date: string) =>
  request<{ success: boolean }>(`/api/participants/${id}/group-overrides/${date}`, {
    method: "DELETE",
  });

export const deleteParticipantGroupOverrideMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ participantId, date }: DeleteParticipantGroupOverrideVariables) =>
      deleteParticipantGroupOverride(participantId, date),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: participantKeys.groupOverrides(variables.participantId),
      });
    },
  });

export interface DropParticipantVariables {
  participantId: number;
  programId: number;
  dropReason?: string;
}

export const dropParticipant = (id: number, dropReason?: string) =>
  request<Participant>(`/api/participants/${id}/drop`, {
    method: "POST",
    body: JSON.stringify({ dropReason }),
  });

export const dropParticipantMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ participantId, dropReason }: DropParticipantVariables) =>
      dropParticipant(participantId, dropReason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: programKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

export interface RegisterParticipantLeaveVariables {
  participantId: number;
  programId: number;
  leaveStart: string;
  leaveEnd: string;
  leaveType: LeaveType;
  reason?: string;
}

export const registerParticipantLeave = (
  id: number,
  data: {
    leaveStart: string;
    leaveEnd: string;
    leaveType: LeaveType;
    reason?: string;
  },
) =>
  request<Participant>(`/api/participants/${id}/leave`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const registerParticipantLeaveMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({
      participantId,
      leaveStart,
      leaveEnd,
      leaveType,
      reason,
    }: RegisterParticipantLeaveVariables) =>
      registerParticipantLeave(participantId, { leaveStart, leaveEnd, leaveType, reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: programKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

export interface EndParticipantLeaveVariables {
  participantId: number;
  programId: number;
}

export const endParticipantLeave = (id: number) =>
  request<Participant>(`/api/participants/${id}/leave/end`, {
    method: "POST",
  });

export const endParticipantLeaveMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ participantId }: EndParticipantLeaveVariables) =>
      endParticipantLeave(participantId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: programKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

export interface ReactivateParticipantVariables {
  participantId: number;
  programId: number;
}

export const reactivateParticipant = (id: number) =>
  request<Participant>(`/api/participants/${id}/reactivate`, {
    method: "POST",
  });

export const reactivateParticipantMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ participantId }: ReactivateParticipantVariables) =>
      reactivateParticipant(participantId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: programKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

export const getAnnualLeave = (id: number, year: string) =>
  request<AnnualLeave>(`/api/participants/${id}/annual-leave?year=${year}`);

export const participantAnnualLeaveQueryOptions = (id: number, year: string) =>
  queryOptions({
    queryKey: participantKeys.annualLeave(id, year),
    queryFn: () => getAnnualLeave(id, year),
  });

export interface SetAnnualLeaveVariables {
  participantId: number;
  year: string;
  totalDays: number;
}

export const setAnnualLeave = (id: number, data: { year: string; totalDays: number }) =>
  request<AnnualLeave>(`/api/participants/${id}/annual-leave`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// critical: 방금 저장한 연차 현황을 그 쿼리 캐시에 바로 반영한다 — 다시 불러오지 않아도 된다.
export const setAnnualLeaveMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ participantId, year, totalDays }: SetAnnualLeaveVariables) =>
      setAnnualLeave(participantId, { year, totalDays }),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(
        participantKeys.annualLeave(variables.participantId, variables.year),
        updated,
      );
    },
  });

export interface BulkUpdateParticipantStatusVariables {
  programId: number;
  participantIds: number[];
  status: "ACTIVE" | "DROPPED";
  dropReason?: string;
}

export const bulkUpdateParticipantStatus = (
  programId: number,
  data: {
    participantIds: number[];
    status: "ACTIVE" | "DROPPED";
    dropReason?: string;
  },
) =>
  request<Participant[]>(`/api/programs/${programId}/participants/bulk-status`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const bulkUpdateParticipantStatusMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({
      programId,
      participantIds,
      status,
      dropReason,
    }: BulkUpdateParticipantStatusVariables) =>
      bulkUpdateParticipantStatus(programId, { participantIds, status, dropReason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: programKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });
