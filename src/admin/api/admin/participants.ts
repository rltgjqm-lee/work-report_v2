import { request } from "../client";
import type { Participant } from "../../types";

export const addParticipant = (
  programId: number,
  data: {
    name: string;
    demandName?: string;
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
    participants: { name: string; demandName?: string; phoneLast4: string }[];
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
      "name" | "demandName" | "phoneLast4" | "birthYear" | "groupId"
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
  data: { leaveStart: string; leaveEnd: string; reason?: string },
) =>
  request<Participant>(`/api/participants/${id}/leave`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const endParticipantLeave = (id: number) =>
  request<Participant>(`/api/participants/${id}/leave/end`, {
    method: "POST",
  });
