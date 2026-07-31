import { mutationOptions, type QueryClient } from "@tanstack/react-query";

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

export const getParticipant = (id: number) =>
  request<ParticipantDetail>(`/api/participants/${id}`);

export const getParticipantAttendance = (id: number, month: string) =>
  request<ParticipantMonthlyAttendance>(
    `/api/participants/${id}/attendance?month=${month}`,
  );

export const getParticipantLeaves = (id: number) =>
  request<ParticipantLeave[]>(`/api/participants/${id}/leaves`);

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

export const updateParticipant = (
  id: number,
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
  >,
) =>
  request<Participant>(`/api/participants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
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
