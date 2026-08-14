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
};

const getMonthlyAttendance = (programId: number, month: string) =>
  request<MonthlyAttendance>(`/api/programs/${programId}/attendance?month=${month}`);

export const monthlyAttendanceQueryOptions = (programId: number, month: string) =>
  queryOptions({
    queryKey: attendanceKeys.monthly(programId, month),
    queryFn: () => getMonthlyAttendance(programId, month),
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

export interface InvalidateAttendanceVariables {
  logId: number;
  programId: number;
  month: string;
  reason?: string;
}

const invalidateAttendance = (logId: number, reason?: string) =>
  request<AttendanceLog>(`/api/attendance/${logId}/invalidate`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const invalidateAttendanceMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ logId, reason }: InvalidateAttendanceVariables) =>
      invalidateAttendance(logId, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.monthly(variables.programId, variables.month),
      });
    },
  });
