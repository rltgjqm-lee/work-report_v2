import type {
  AdminSession,
  Group,
  Organization,
  Participant,
  Program,
  ProgramWithParticipants,
  SafetyAlert,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

let onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (handler: () => void) => {
  onUnauthorized = handler;
};

// Cloudflare Access가 이 Worker 앞단에서 로그인을 처리하고 CF-Access-JWT-Assertion을
// 요청에 실어 보낸다 — 브라우저가 그 인증 쿠키를 함께 보내야 하므로 credentials: "include".
// 클라이언트가 직접 토큰을 들고 있거나 Authorization 헤더를 붙이는 부분은 없다.
const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    onUnauthorized?.();
    throw new Error("접근 권한이 없습니다.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `요청 실패 (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

export const getMe = () => request<AdminSession>("/api/me");

export const listOrganizations = () =>
  request<Organization[]>("/api/organizations");

export const getOrganization = (id: number) =>
  request<Organization>(`/api/organizations/${id}`);

export const createOrganization = (
  data: Partial<Omit<Organization, "id" | "createdAt">>,
) =>
  request<Organization>("/api/organizations", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateOrganization = (
  id: number,
  data: Partial<Omit<Organization, "id" | "createdAt">>,
) =>
  request<Organization>(`/api/organizations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteOrganization = (id: number) =>
  request<{ success: boolean }>(`/api/organizations/${id}`, {
    method: "DELETE",
  });

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

export const deleteProgram = (id: number) =>
  request<{ success: boolean }>(`/api/programs/${id}`, { method: "DELETE" });

export const addParticipant = (
  programId: number,
  data: {
    name: string;
    demandName?: string;
    phoneLast4: string;
    groupId?: number;
    birthYear?: number;
  },
) =>
  request<Participant>(`/api/programs/${programId}/participants`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteParticipant = (programId: number, participantId: number) =>
  request<{ success: boolean }>(
    `/api/programs/${programId}/participants/${participantId}`,
    { method: "DELETE" },
  );

export const bulkAddParticipants = (
  programId: number,
  data: {
    participants: { name: string; demandName?: string; phoneLast4: string }[];
  },
) =>
  request<Participant[]>(`/api/programs/${programId}/participants/bulk`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateParticipant = (
  id: number,
  data: Partial<
    Pick<
      Participant,
      "name" | "demandName" | "phoneLast4" | "birthYear" | "groupId"
    >
  >,
) =>
  request<Participant>(`/api/participants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const moveParticipantToGroup = (id: number, groupId: number) =>
  request<Participant>(`/api/participants/${id}/group`, {
    method: "POST",
    body: JSON.stringify({ groupId }),
  });

export const dropParticipant = (id: number, dropReason?: string) =>
  request<Participant>(`/api/participants/${id}/drop`, {
    method: "POST",
    body: JSON.stringify({ dropReason }),
  });

export const registerParticipantLeave = (
  id: number,
  data: { leaveStart: string; leaveEnd: string; reason?: string },
) =>
  request<Participant>(`/api/participants/${id}/leave`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const endParticipantLeave = (id: number) =>
  request<Participant>(`/api/participants/${id}/leave/end`, {
    method: "POST",
  });

export const listGroups = (programId: number) =>
  request<Group[]>(`/api/programs/${programId}/groups`);

export const createGroup = (
  programId: number,
  data: {
    name: string;
    description?: string;
    shiftStart: string;
    shiftEnd: string;
  },
) =>
  request<Group>(`/api/programs/${programId}/groups`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateGroup = (
  id: number,
  data: Partial<
    Pick<Group, "name" | "description" | "shiftStart" | "shiftEnd" | "isActive">
  >,
) =>
  request<Group>(`/api/groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteGroup = (id: number) =>
  request<{ success: boolean }>(`/api/groups/${id}`, { method: "DELETE" });

export const bulkAssignGroup = (participantIds: number[], groupId: number) =>
  request<{ updated: number }>("/api/groups/bulk-assign", {
    method: "POST",
    body: JSON.stringify({ participantIds, groupId }),
  });

export const getMonthlyAttendance = (programId: number, month: string) =>
  request<unknown[]>(`/api/programs/${programId}/attendance?month=${month}`);

const downloadFile = async (path: string, filename: string) => {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadActivityLogExcel = (programId: number, month: string) =>
  downloadFile(
    `/api/programs/${programId}/export/activity-log?month=${month}`,
    `활동일지_${month}.csv`,
  );

export const downloadAttendanceExcel = (programId: number, month: string) =>
  downloadFile(
    `/api/programs/${programId}/export/attendance?month=${month}`,
    `출근부_${month}.csv`,
  );

export const downloadPaymentExcel = (programId: number, month: string) =>
  downloadFile(
    `/api/programs/${programId}/export/payment?month=${month}`,
    `급여대장_${month}.csv`,
  );

export const listSafetyAlerts = () =>
  request<SafetyAlert[]>("/api/safety-alerts");
