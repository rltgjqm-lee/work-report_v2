import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type { LeaveType } from "../../types/participants";

import { request } from "../client";
import { attendanceKeys } from "./attendance";
import { groupKeys } from "./groups";
import { leavesKeys } from "./leaves";
import { participantKeys } from "./participants";
import { programKeys } from "./programs";

// 조 일괄 휴무 — 조 수정 달력에서 날짜마다 유급/무급을 찍는다. 저장하면 서버가 조원마다
// 그 날 하루짜리 개인 휴무를 만들어서, 근무 탭·휴가 탭·참여자 상세에 그대로 반영된다.
// 근무일과는 독립이다 — 유급 휴무는 원래 근무일에 연차를 쓰는 것이라 근무일을 지우지 않는다.
export interface GroupLeave {
  date: string; // "YYYY-MM-DD"
  leaveType: LeaveType;
}

export interface GroupLeaves {
  groupId: number;
  leaves: GroupLeave[];
}

// 새로 넣을 유급 휴무만큼 연차가 모자란 조원 — 연도별로 따로 센다(휴무 날짜의 연도 연차에서 빠지므로).
export interface AnnualLeaveShortage {
  participantId: number;
  name: string;
  year: string;
  remainingDays: number;
  requiredDays: number;
}

export const groupLeavesKeys = {
  all: ["group-leaves"] as const,
  detail: (groupId: number) => [...groupLeavesKeys.all, groupId] as const,
};

const getGroupLeaves = (groupId: number) => request<GroupLeaves>(`/api/groups/${groupId}/leaves`);

export const groupLeavesQueryOptions = (groupId: number) =>
  queryOptions({
    queryKey: groupLeavesKeys.detail(groupId),
    queryFn: () => getGroupLeaves(groupId),
  });

// 저장 전에 "이 사람들은 빼고 진행할까요?"를 묻기 위한 조회 — POST지만 아무것도 바꾸지 않는다.
export const previewGroupLeaves = (groupId: number, leaves: GroupLeave[]) =>
  request<{ shortages: AnnualLeaveShortage[] }>(`/api/groups/${groupId}/leaves/preview`, {
    method: "POST",
    body: JSON.stringify({ leaves }),
  });

export interface UpdateGroupLeavesVariables {
  groupId: number;
  // 캐시 무효화 대상(그 사업단의 참여자 상태·휴가·근무 목록)을 찾기 위한 값 — 서버에 보내지 않는다.
  programId: number;
  leaves: GroupLeave[];
}

export type UpdateGroupLeavesResult = GroupLeaves & { skipped: AnnualLeaveShortage[] };

const updateGroupLeaves = (groupId: number, leaves: GroupLeave[]) =>
  request<UpdateGroupLeavesResult>(`/api/groups/${groupId}/leaves`, {
    method: "PUT",
    body: JSON.stringify({ leaves }),
  });

export const updateGroupLeavesMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ groupId, leaves }: UpdateGroupLeavesVariables) =>
      updateGroupLeaves(groupId, leaves),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupLeavesKeys.detail(variables.groupId) });
      // 조원 개인 휴무가 생기고 지워지므로, 그 기록을 읽는 화면을 전부 비운다 —
      // 참여자 상태(휴무 중), 휴가 탭, 근무 탭(미출근 판정), 참여자 상세(이력·잔여 연차).
      queryClient.invalidateQueries({ queryKey: programKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
      queryClient.invalidateQueries({ queryKey: leavesKeys.all });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      queryClient.invalidateQueries({ queryKey: participantKeys.all });
    },
  });
