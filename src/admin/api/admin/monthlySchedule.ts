import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type { GroupMonthlySchedule } from "../../types/groups";
import type { ParticipantMonthlySchedule } from "../../types/participants";

import { request } from "../client";

const groupMonthlyScheduleKeys = {
  all: ["group-monthly-schedule"] as const,
  detail: (groupId: number, month: string) =>
    [...groupMonthlyScheduleKeys.all, groupId, month] as const,
};

const getGroupMonthlySchedule = (groupId: number, month: string) =>
  request<GroupMonthlySchedule>(`/api/groups/${groupId}/monthly-schedule?month=${month}`);

export const groupMonthlyScheduleQueryOptions = (groupId: number, month: string) =>
  queryOptions({
    queryKey: groupMonthlyScheduleKeys.detail(groupId, month),
    queryFn: () => getGroupMonthlySchedule(groupId, month),
  });

export interface UpdateGroupMonthlyScheduleVariables {
  groupId: number;
  yearMonth: string;
  workDates: string[];
  maxMonthlyMinutes: number;
}

const updateGroupMonthlySchedule = (
  groupId: number,
  data: { yearMonth: string; workDates: string[]; maxMonthlyMinutes: number },
) =>
  request<GroupMonthlySchedule>(`/api/groups/${groupId}/monthly-schedule`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const updateGroupMonthlyScheduleMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({
      groupId,
      yearMonth,
      workDates,
      maxMonthlyMinutes,
    }: UpdateGroupMonthlyScheduleVariables) =>
      updateGroupMonthlySchedule(groupId, { yearMonth, workDates, maxMonthlyMinutes }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: groupMonthlyScheduleKeys.detail(variables.groupId, variables.yearMonth),
      });
    },
  });

const participantMonthlyScheduleKeys = {
  all: ["participant-monthly-schedule"] as const,
  detail: (participantId: number, month: string) =>
    [...participantMonthlyScheduleKeys.all, participantId, month] as const,
};

const getParticipantMonthlySchedule = (participantId: number, month: string) =>
  request<ParticipantMonthlySchedule>(
    `/api/participants/${participantId}/monthly-schedule?month=${month}`,
  );

export const participantMonthlyScheduleQueryOptions = (participantId: number, month: string) =>
  queryOptions({
    queryKey: participantMonthlyScheduleKeys.detail(participantId, month),
    queryFn: () => getParticipantMonthlySchedule(participantId, month),
  });

export interface UpdateParticipantMonthlyScheduleVariables {
  participantId: number;
  yearMonth: string;
  workDates: string[];
  maxMonthlyMinutes: number | null;
}

const updateParticipantMonthlySchedule = (
  participantId: number,
  data: {
    yearMonth: string;
    workDates: string[];
    maxMonthlyMinutes: number | null;
  },
) =>
  request<ParticipantMonthlySchedule>(`/api/participants/${participantId}/monthly-schedule`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const updateParticipantMonthlyScheduleMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({
      participantId,
      yearMonth,
      workDates,
      maxMonthlyMinutes,
    }: UpdateParticipantMonthlyScheduleVariables) =>
      updateParticipantMonthlySchedule(participantId, { yearMonth, workDates, maxMonthlyMinutes }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: participantMonthlyScheduleKeys.detail(
          variables.participantId,
          variables.yearMonth,
        ),
      });
    },
  });

export interface DeleteParticipantMonthlyScheduleVariables {
  participantId: number;
  yearMonth: string;
}

const deleteParticipantMonthlySchedule = (participantId: number, month: string) =>
  request<{ success: boolean }>(
    `/api/participants/${participantId}/monthly-schedule?month=${month}`,
    { method: "DELETE" },
  );

export const deleteParticipantMonthlyScheduleMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ participantId, yearMonth }: DeleteParticipantMonthlyScheduleVariables) =>
      deleteParticipantMonthlySchedule(participantId, yearMonth),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: participantMonthlyScheduleKeys.detail(
          variables.participantId,
          variables.yearMonth,
        ),
      });
    },
  });
