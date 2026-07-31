import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";
import type {
  DemandSite,
  DemandSiteLocation,
  DemandSiteLocationShape,
  DemandSiteSchedule,
  LatLngPoint,
} from "../../types";

export const demandSiteKeys = {
  all: ["demand-sites"] as const,
  byProgram: (programId: number) => [...demandSiteKeys.all, "program", programId] as const,
  schedules: (demandSiteId: number) => [...demandSiteKeys.all, "schedules", demandSiteId] as const,
  assignableAdmins: (programId: number) =>
    [...demandSiteKeys.all, "assignable-admins", programId] as const,
  locations: (demandSiteId: number) => [...demandSiteKeys.all, "locations", demandSiteId] as const,
};

export const listDemandSites = (programId: number) =>
  request<DemandSite[]>(`/api/demand-sites?programId=${programId}`);

export const demandSitesQueryOptions = (programId: number) =>
  queryOptions({
    queryKey: demandSiteKeys.byProgram(programId),
    queryFn: () => listDemandSites(programId),
  });

// 수요처 담당자로 지정할 수 있는 계정(담당자 역할) — 계정 관리 화면과 달리
// 부관리자/담당자도 조회할 수 있고 id/이름만 내려온다.
export const listAssignableDemandSiteAdmins = (programId: number) =>
  request<{ id: number; name: string | null }[]>(
    `/api/demand-sites/assignable-admins?programId=${programId}`,
  );

export const assignableDemandSiteAdminsQueryOptions = (programId: number) =>
  queryOptions({
    queryKey: demandSiteKeys.assignableAdmins(programId),
    queryFn: () => listAssignableDemandSiteAdmins(programId),
  });

export interface CreateDemandSiteVariables {
  programId: number;
  name: string;
  address?: string;
  baseLat?: number | null;
  baseLng?: number | null;
  radius?: number | null;
}

export const createDemandSite = (data: CreateDemandSiteVariables) =>
  request<DemandSite>("/api/demand-sites", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createDemandSiteMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: createDemandSite,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: demandSiteKeys.byProgram(variables.programId) });
    },
  });

export interface UpdateDemandSiteVariables {
  id: number;
  programId: number;
  data: Partial<{
    name: string;
    address: string;
    contactAdminId: number | null;
    baseLat: number | null;
    baseLng: number | null;
    radius: number | null;
    isActive: boolean;
  }>;
}

export const updateDemandSite = (id: number, data: UpdateDemandSiteVariables["data"]) =>
  request<DemandSite>(`/api/demand-sites/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// programId는 서버에 보내지 않고 캐시 무효화 대상(그 사업단의 수요처 목록)을 찾는 데만 쓴다.
export const updateDemandSiteMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, data }: UpdateDemandSiteVariables) => updateDemandSite(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: demandSiteKeys.byProgram(variables.programId) });
    },
  });

export const listDemandSiteSchedules = (demandSiteId: number) =>
  request<DemandSiteSchedule[]>(`/api/demand-sites/${demandSiteId}/schedules`);

export const demandSiteSchedulesQueryOptions = (demandSiteId: number) =>
  queryOptions({
    queryKey: demandSiteKeys.schedules(demandSiteId),
    queryFn: () => listDemandSiteSchedules(demandSiteId),
  });

export interface CreateDemandSiteScheduleVariables {
  demandSiteId: number;
  data: { groupId: number; shiftStart: string; shiftEnd: string };
}

export const createDemandSiteSchedule = (
  demandSiteId: number,
  data: CreateDemandSiteScheduleVariables["data"],
) =>
  request<DemandSiteSchedule>(`/api/demand-sites/${demandSiteId}/schedules`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createDemandSiteScheduleMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ demandSiteId, data }: CreateDemandSiteScheduleVariables) =>
      createDemandSiteSchedule(demandSiteId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: demandSiteKeys.schedules(variables.demandSiteId),
      });
    },
  });

export const updateDemandSiteSchedule = (
  scheduleId: number,
  data: Partial<{ shiftStart: string; shiftEnd: string }>,
) =>
  request<DemandSiteSchedule>(`/api/demand-sites/schedules/${scheduleId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export interface DeleteDemandSiteScheduleVariables {
  scheduleId: number;
  demandSiteId: number;
}

export const deleteDemandSiteSchedule = (scheduleId: number) =>
  request<{ success: boolean }>(`/api/demand-sites/schedules/${scheduleId}`, {
    method: "DELETE",
  });

export const deleteDemandSiteScheduleMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ scheduleId }: DeleteDemandSiteScheduleVariables) =>
      deleteDemandSiteSchedule(scheduleId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: demandSiteKeys.schedules(variables.demandSiteId),
      });
    },
  });

export const listDemandSiteLocations = (demandSiteId: number) =>
  request<DemandSiteLocation[]>(`/api/demand-sites/${demandSiteId}/locations`);

export const demandSiteLocationsQueryOptions = (demandSiteId: number) =>
  queryOptions({
    queryKey: demandSiteKeys.locations(demandSiteId),
    queryFn: () => listDemandSiteLocations(demandSiteId),
  });

export interface CreateDemandSiteLocationVariables {
  demandSiteId: number;
  data: {
    name: string;
    shapeType: DemandSiteLocationShape;
    baseLat?: number;
    baseLng?: number;
    radius?: number;
    polygon?: LatLngPoint[];
  };
}

export const createDemandSiteLocation = (
  demandSiteId: number,
  data: CreateDemandSiteLocationVariables["data"],
) =>
  request<DemandSiteLocation>(`/api/demand-sites/${demandSiteId}/locations`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createDemandSiteLocationMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ demandSiteId, data }: CreateDemandSiteLocationVariables) =>
      createDemandSiteLocation(demandSiteId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: demandSiteKeys.locations(variables.demandSiteId) });
    },
  });

export const updateDemandSiteLocation = (
  locationId: number,
  data: Partial<{
    name: string;
    shapeType: DemandSiteLocationShape;
    baseLat: number;
    baseLng: number;
    radius: number;
    polygon: LatLngPoint[];
  }>,
) =>
  request<DemandSiteLocation>(`/api/demand-sites/locations/${locationId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export interface DeleteDemandSiteLocationVariables {
  locationId: number;
  demandSiteId: number;
}

export const deleteDemandSiteLocation = (locationId: number) =>
  request<{ success: boolean }>(`/api/demand-sites/locations/${locationId}`, {
    method: "DELETE",
  });

export const deleteDemandSiteLocationMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ locationId }: DeleteDemandSiteLocationVariables) =>
      deleteDemandSiteLocation(locationId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: demandSiteKeys.locations(variables.demandSiteId) });
    },
  });
