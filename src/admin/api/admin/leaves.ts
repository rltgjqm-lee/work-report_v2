import { queryOptions } from "@tanstack/react-query";

import type { ParticipantLeave } from "../../types/participants";

import { request } from "../client";

export type LeaveRow = {
  leave: ParticipantLeave;
  participantName: string;
  groupName: string | null;
  annualTotalDays: number | null;
  annualUsedDays: number | null;
  annualRemainingDays: number | null;
};

export type LeaveMonthlyStat = {
  month: string;
  totalLeaves: number;
  paidLeaves: number;
  unpaidLeaves: number;
  totalDays: number;
};

export type LeavesByYear = {
  leaves: LeaveRow[];
  monthly: LeaveMonthlyStat[];
};

export const leavesKeys = {
  all: ["leaves"] as const,
  byYear: (programId: number, year: string) => [...leavesKeys.all, programId, year] as const,
  // byYear(programId, year)를 prefix로 두므로, 수요처 필터 없이 그 키로 무효화하면
  // 이 아래 모든 demandSiteId 변형이 다 같이 무효화된다.
  byYearAndDemandSite: (programId: number, year: string, demandSiteId: number | null) =>
    [...leavesKeys.byYear(programId, year), demandSiteId ?? "all"] as const,
};

// 그 해 전체 휴가 목록 + 월별 집계를 한 번에 받는다
// 수요처 소속 참여자의 휴가만 조회한다.
const getLeavesByYear = (programId: number, year: string, demandSiteId: number | null) => {
  const params = new URLSearchParams({ year });
  if (demandSiteId) params.set("demandSiteId", String(demandSiteId));
  return request<LeavesByYear>(`/api/programs/${programId}/leaves?${params.toString()}`);
};

export const leavesQueryOptions = (
  programId: number,
  year: string,
  demandSiteId: number | null = null,
) =>
  queryOptions({
    queryKey: leavesKeys.byYearAndDemandSite(programId, year, demandSiteId),
    queryFn: () => getLeavesByYear(programId, year, demandSiteId),
  });
