import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type { ParticipantMonthlySchedule } from "../../types/participants";

import { request } from "../client";

// 조 기본 근무시간(Group.shiftStart/shiftEnd)과 다른 날의 근무시간. 그 달 근무일 중
// 시간이 다른 날만 들어있고, 없는 날은 조 기본값으로 근무한다는 뜻이다 — "이번주는
// 오전, 다음주는 오후"처럼 같은 조가 날짜마다 다른 시간에 일하는 편성을 이걸로 표현한다.
export interface GroupShiftOverride {
  date: string; // "YYYY-MM-DD"
  shiftStart: string; // "HH:MM"
  shiftEnd: string;
}

export interface GroupMonthlySchedule {
  groupId: number;
  yearMonth: string;
  workDates: string[];
  maxMonthlyMinutes: number;
  shiftOverrides: GroupShiftOverride[];
}

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

// 사업단 기간 전체의 편성 — 조를 만들 때 기간 전체를 한 번에 깔고, 수정할 때도
// 달을 넘기며 볼 수 있게 통째로 들고 온다. 근무일이 없는 달은 아예 빠져 있다.
export interface GroupSchedule {
  groupId: number;
  months: GroupMonthlySchedule[];
}

const groupScheduleKeys = {
  all: ["group-schedule"] as const,
  detail: (groupId: number) => [...groupScheduleKeys.all, groupId] as const,
};

const getGroupSchedule = (groupId: number) =>
  request<GroupSchedule>(`/api/groups/${groupId}/schedule`);

export const groupScheduleQueryOptions = (groupId: number | undefined) =>
  queryOptions({
    queryKey: groupScheduleKeys.detail(groupId ?? 0),
    queryFn: () => getGroupSchedule(groupId as number),
    enabled: !!groupId,
  });

export interface UpdateGroupScheduleVariables {
  groupId: number;
  months: {
    yearMonth: string;
    workDates: string[];
    maxMonthlyMinutes: number;
    // 생략하면 그 달의 날짜별 근무시간을 건드리지 않는다 — 빈 배열(전부 삭제)과 다르다.
    shiftOverrides?: GroupShiftOverride[];
  }[];
}

const updateGroupSchedule = (groupId: number, months: UpdateGroupScheduleVariables["months"]) =>
  request<GroupSchedule>(`/api/groups/${groupId}/schedule`, {
    method: "PUT",
    body: JSON.stringify({ months }),
  });

export const updateGroupScheduleMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ groupId, months }: UpdateGroupScheduleVariables) =>
      updateGroupSchedule(groupId, months),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupScheduleKeys.detail(variables.groupId) });
      // 월별 조회(출근부 훈련 탭, 참여자 개인 예외 모달)도 같은 편성을 읽으므로 같이 비운다.
      queryClient.invalidateQueries({ queryKey: groupMonthlyScheduleKeys.all });
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
