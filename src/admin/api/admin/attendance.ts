import { request } from "../client";
import type { AttendanceLog } from "../../types";

export const correctAttendance = (
  logId: number,
  data: {
    clockIn?: string; // "HH:MM"
    clockOut?: string; // "HH:MM"
    status?: "NORMAL" | "LATE" | "EARLY_LEAVE";
    reason: string;
  },
) =>
  request<AttendanceLog>(`/api/attendance/${logId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const invalidateAttendance = (logId: number, reason?: string) =>
  request<AttendanceLog>(`/api/attendance/${logId}/invalidate`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
