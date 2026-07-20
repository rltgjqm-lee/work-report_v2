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
