import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type { ActivityLogSummary, AttendanceLog, AttendanceStats } from "../../types/attendance";

import { request } from "../client";

export type AttendanceRow = {
  log: AttendanceLog;
  participantName: string;
  groupName: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  activity: ActivityLogSummary;
  // 위치 열 옆에 보여주는, 그날 처리된 안전관제 이탈 상태/메모(서버가 조인해서 내려줌).
  escapeStatus: "OPEN" | "RESOLVED" | null;
  escapeMemo: string | null;
};

export type MonthlyAttendance = {
  logs: AttendanceRow[];
  stats: AttendanceStats;
};

export const attendanceKeys = {
  all: ["attendance"] as const,
  monthly: (programId: number, month: string) => [...attendanceKeys.all, programId, month] as const,
  // monthly(programId, month)를 prefix로 두므로, 수요처 필터 없이 그 키로 무효화하면
  // 이 아래 모든 demandSiteId 변형이 다 같이 무효화된다.
  monthlyByDemandSite: (programId: number, month: string, demandSiteId: number | null) =>
    [...attendanceKeys.monthly(programId, month), demandSiteId ?? "all"] as const,
};

// demandSiteId를 주면 그 수요처 소속 참여자의 근무 기록만 DB에서 걸러서 받는다 —
// 참여자 목록을 따로 받아 브라우저에서 다시 조인할 필요가 없다.
const getMonthlyAttendance = (programId: number, month: string, demandSiteId: number | null) => {
  const params = new URLSearchParams({ month });
  if (demandSiteId) params.set("demandSiteId", String(demandSiteId));
  return request<MonthlyAttendance>(`/api/programs/${programId}/attendance?${params.toString()}`);
};

export const monthlyAttendanceQueryOptions = (
  programId: number,
  month: string,
  demandSiteId: number | null = null,
) =>
  queryOptions({
    queryKey: attendanceKeys.monthlyByDemandSite(programId, month, demandSiteId),
    queryFn: () => getMonthlyAttendance(programId, month, demandSiteId),
  });

export interface CorrectAttendanceVariables {
  logId: number;
  // 서버로 보내는 값이 아니라, 성공 후 어느 월별 근무 목록을 무효화할지 찾기 위한 값이다.
  programId: number;
  month: string;
  data: {
    clockIn?: string; // "HH:MM"
    clockOut?: string; // "HH:MM"
    status?: "NORMAL" | "LATE" | "EARLY_LEAVE";
    reason: string;
  };
}

const correctAttendance = (logId: number, data: CorrectAttendanceVariables["data"]) =>
  request<AttendanceLog>(`/api/attendance/${logId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// critical: 수정된 근무 기록이 속한 월별 목록을 무효화한다 — 어느 화면에서 호출하든 항상 필요.
// 모달 닫기 같은 UI 한정 동작은 호출부의 mutate(variables, { onSuccess, onError })에 둔다.
export const correctAttendanceMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ logId, data }: CorrectAttendanceVariables) => correctAttendance(logId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.monthly(variables.programId, variables.month),
      });
    },
  });

export interface DeactivateAttendanceVariables {
  logId: number;
  programId: number;
  month: string;
  reason?: string;
}

const deactivateAttendance = (logId: number, reason?: string) =>
  request<AttendanceLog>(`/api/attendance/${logId}/deactivate`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const deactivateAttendanceMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ logId, reason }: DeactivateAttendanceVariables) =>
      deactivateAttendance(logId, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.monthly(variables.programId, variables.month),
      });
    },
  });

export interface ActivateAttendanceVariables {
  logId: number;
  programId: number;
  month: string;
}

const activateAttendance = (logId: number) =>
  request<AttendanceLog>(`/api/attendance/${logId}/activate`, { method: "POST" });

export const activateAttendanceMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ logId }: ActivateAttendanceVariables) => activateAttendance(logId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.monthly(variables.programId, variables.month),
      });
    },
  });
