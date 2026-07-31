import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";

import { request } from "../client";
import { programKeys } from "./programs";
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
};

export const getParticipant = (id: number) =>
  request<ParticipantDetail>(`/api/participants/${id}`);

export const participantQueryOptions = (id: number) =>
  queryOptions({
    queryKey: participantKeys.detail(id),
    queryFn: () => getParticipant(id),
  });

export const getParticipantAttendance = (id: number, month: string) =>
  request<ParticipantMonthlyAttendance>(
    `/api/participants/${id}/attendance?month=${month}`,
  );

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

export const addParticipant = (
  programId: number,
  data: {
    name: string;
    demandSiteId?: number;
    phoneLast4: string;
    groupId?: number;
    birthYear?: number;
  },
) =>
  request<Participant>(`/api/programs/${programId}/participants`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteParticipant = (programId: number, participantId: number) =>
  request<{ success: boolean }>(
    `/api/programs/${programId}/participants/${participantId}`,
    { method: "DELETE" },
  );

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
    },
  });

export const bulkAddParticipants = (
  programId: number,
  data: {
    participants: {
      name: string;
      demandSiteId?: number;
      phoneLast4: string;
      groupId?: number;
    }[];
  },
) =>
  request<Participant[]>(`/api/programs/${programId}/participants/bulk`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export interface UpdateParticipantVariables {
  id: number;
  data: Partial<
    Pick<
      Participant,
      | "name"
      | "demandName"
      | "demandSiteId"
      | "phoneLast4"
      | "birthYear"
      | "groupId"
      | "educationAmount"
      | "educationType"
      | "dementiaAmount"
      | "dementiaType"
      | "socialInsuranceEnrolled"
      | "weeklyHolidayHours"
    >
  >;
}

export const updateParticipant = (
  id: number,
  data: UpdateParticipantVariables["data"],
) =>
  request<Participant>(`/api/participants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// critical: 방금 수정한 필드를 참여자 상세 쿼리 캐시에 바로 반영한다 — 다시 불러오지
// 않아도 상세 화면이 최신 상태를 보여준다. 모달 닫기 같은 UI 한정 동작은 호출부의
// mutate(variables, { onSuccess, onError })에 둔다.
export const updateParticipantMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, data }: UpdateParticipantVariables) =>
      updateParticipant(id, data),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(
        participantKeys.detail(variables.id),
        (previous: ParticipantDetail | undefined) =>
          previous ? { ...previous, ...updated } : previous,
      );
    },
  });

export const moveParticipantToGroup = (id: number, groupId: number) =>
  request<Participant>(`/api/participants/${id}/group`, {
    method: "POST",
    body: JSON.stringify({ groupId }),
  });

export const dropParticipant = (id: number, dropReason?: string) =>
  request<Participant>(`/api/participants/${id}/drop`, {
    method: "POST",
    body: JSON.stringify({ dropReason }),
  });

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

export const endParticipantLeave = (id: number) =>
  request<Participant>(`/api/participants/${id}/leave/end`, {
    method: "POST",
  });

export const reactivateParticipant = (id: number) =>
  request<Participant>(`/api/participants/${id}/reactivate`, {
    method: "POST",
  });

export const getAnnualLeave = (id: number, year: string) =>
  request<AnnualLeave>(`/api/participants/${id}/annual-leave?year=${year}`);

export const participantAnnualLeaveQueryOptions = (id: number, year: string) =>
  queryOptions({
    queryKey: participantKeys.annualLeave(id, year),
    queryFn: () => getAnnualLeave(id, year),
  });

export const setAnnualLeave = (
  id: number,
  data: { year: string; totalDays: number },
) =>
  request<AnnualLeave>(`/api/participants/${id}/annual-leave`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const bulkUpdateParticipantStatus = (
  programId: number,
  data: {
    participantIds: number[];
    status: "ACTIVE" | "DROPPED";
    dropReason?: string;
  },
) =>
  request<Participant[]>(
    `/api/programs/${programId}/participants/bulk-status`,
    { method: "POST", body: JSON.stringify(data) },
  );
