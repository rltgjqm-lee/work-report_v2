import { request } from "../client";
import type { AnnualLeave, LeaveType, Participant } from "../../types";

export const addParticipant = (
  programId: number,
  data: {
    name: string;
    demandName?: string;
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

export const bulkAddParticipants = (
  programId: number,
  data: {
    participants: {
      name: string;
      demandName?: string;
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
