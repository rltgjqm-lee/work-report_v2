import { request } from "../client";
import type {
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
