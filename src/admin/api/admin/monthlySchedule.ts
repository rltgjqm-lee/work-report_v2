import { request } from "../client";
import type {
  GroupMonthlySchedule,
  ParticipantMonthlySchedule,
} from "../../types";

export const getGroupMonthlySchedule = (groupId: number, month: string) =>
  request<GroupMonthlySchedule>(
    `/api/groups/${groupId}/monthly-schedule?month=${month}`,
  );

export const updateGroupMonthlySchedule = (
  groupId: number,
  data: { yearMonth: string; workDates: string[]; maxMonthlyMinutes: number },
) =>
  request<GroupMonthlySchedule>(`/api/groups/${groupId}/monthly-schedule`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const getParticipantMonthlySchedule = (
  participantId: number,
  month: string,
) =>
  request<ParticipantMonthlySchedule>(
    `/api/participants/${participantId}/monthly-schedule?month=${month}`,
  );

export const updateParticipantMonthlySchedule = (
  participantId: number,
  data: {
    yearMonth: string;
    workDates: string[];
    maxMonthlyMinutes: number | null;
  },
) =>
  request<ParticipantMonthlySchedule>(
    `/api/participants/${participantId}/monthly-schedule`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );

export const deleteParticipantMonthlySchedule = (
  participantId: number,
  month: string,
) =>
  request<{ success: boolean }>(
    `/api/participants/${participantId}/monthly-schedule?month=${month}`,
    { method: "DELETE" },
  );
