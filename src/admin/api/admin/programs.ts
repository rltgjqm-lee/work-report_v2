import { request } from "../client";
import type {
  EscapeRow,
  EscapeStatus,
  LeaveRow,
  LeaveStats,
  LiveWorker,
  MonthlyAttendance,
  Program,
  ProgramWithParticipants,
} from "../../types";

export const listPrograms = (organizationId?: number) =>
  request<Program[]>(
    `/api/programs${organizationId ? `?organizationId=${organizationId}` : ""}`,
  );

export const getProgram = (id: number) =>
  request<ProgramWithParticipants>(`/api/programs/${id}`);

export const createProgram = (
  data: Partial<Omit<Program, "id" | "createdAt">>,
) =>
  request<Program>("/api/programs", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProgram = (
  id: number,
  data: Partial<Omit<Program, "id" | "createdAt" | "organizationId">>,
) =>
  request<Program>(`/api/programs/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// 사업단 담당자 지정 — 이전/새 담당자 계정의 담당 사업단 목록을 서버가 한 번에 정리하고,
// 그 사업단 소속 수요처의 담당자까지 같이 갈아끼운다.
export const setProgramManager = (programId: number, adminId: number | null) =>
  request<{ ok: true; adminId: number | null }>(
    `/api/programs/${programId}/manager`,
    { method: "PUT", body: JSON.stringify({ adminId }) },
  );

export const getMonthlyAttendance = (programId: number, month: string) =>
  request<MonthlyAttendance>(
    `/api/programs/${programId}/attendance?month=${month}`,
  );

export const getLeaves = (programId: number, month?: string) =>
  request<LeaveRow[]>(
    `/api/programs/${programId}/leaves${month ? `?month=${month}` : ""}`,
  );

export const getLeaveStats = (programId: number, year: string) =>
  request<LeaveStats>(`/api/programs/${programId}/leaves/stats?year=${year}`);

export const getEscapes = (programId: number, status: EscapeStatus = "OPEN") =>
  request<EscapeRow[]>(`/api/programs/${programId}/escapes?status=${status}`);

export const getLiveWorkers = (programId: number) =>
  request<LiveWorker[]>(`/api/programs/${programId}/workers/live`);
