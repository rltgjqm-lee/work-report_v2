import { queryOptions } from "@tanstack/react-query";

import { request } from "../client";
import type { ParticipantLeave } from "../../types/participants";

export type LeaveRow = {
  leave: ParticipantLeave;
  participantName: string;
  groupName: string | null;
  annualTotalDays: number | null;
  annualUsedDays: number | null;
  annualRemainingDays: number | null;
};

type LeaveMonthlyStat = {
  month: string;
  totalLeaves: number;
  paidLeaves: number;
  unpaidLeaves: number;
  totalDays: number;
};

export type LeaveStats = {
  monthly: LeaveMonthlyStat[];
  annual: {
    participants: number;
    totalAnnual: number;
    usedAnnual: number;
    remainingAnnual: number;
  };
};

export const leavesKeys = {
  all: ["leaves"] as const,
  byMonth: (programId: number, month: string) => [...leavesKeys.all, programId, month] as const,
  stats: (programId: number, year: string) =>
    [...leavesKeys.all, "stats", programId, year] as const,
};

const getLeaves = (programId: number, month: string) =>
  request<LeaveRow[]>(`/api/programs/${programId}/leaves?month=${month}`);

export const leavesQueryOptions = (programId: number, month: string) =>
  queryOptions({
    queryKey: leavesKeys.byMonth(programId, month),
    queryFn: () => getLeaves(programId, month),
  });

const getLeaveStats = (programId: number, year: string) =>
  request<LeaveStats>(`/api/programs/${programId}/leaves/stats?year=${year}`);

export const leaveStatsQueryOptions = (programId: number, year: string) =>
  queryOptions({
    queryKey: leavesKeys.stats(programId, year),
    queryFn: () => getLeaveStats(programId, year),
  });
