import { LOCAL_STORAGE_KEYS } from "../../constants/storage";
import type {
  Organization,
  Participant,
  Program,
  ProgramWithParticipants,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

let onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (handler: () => void) => {
  onUnauthorized = handler;
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const token = localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_JWT);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `요청 실패 (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

export const login = (username: string, password: string) =>
  request<{ token: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

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
  data: { name: string; demandName?: string; phoneLast4: string },
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
