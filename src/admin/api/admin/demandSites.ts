import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type {
  DemandSite,
  DemandSiteLocation,
  DemandSiteLocationShape,
  DemandSiteSchedule,
  LatLngPoint,
} from "../../types/demandSites";

import { request } from "../client";

const demandSiteKeys = {
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

// 수요처 담당자로 지정할 수 있는 계정(담당자/부관리자 역할) — 계정 관리 화면과 달리
// 부관리자/담당자도 조회할 수 있고 id/이름만 내려온다.
const listAssignableDemandSiteAdmins = (programId: number) =>
  request<{ id: number; name: string | null }[]>(
    `/api/demand-sites/assignable-admins?programId=${programId}`,
  );

export const assignableDemandSiteAdminsQueryOptions = (programId: number) =>
  queryOptions({
    queryKey: demandSiteKeys.assignableAdmins(programId),
    queryFn: () => listAssignableDemandSiteAdmins(programId),
  });

interface CreateDemandSiteVariables {
  programId: number;
  name: string;
  address?: string;
  baseLat?: number | null;
  baseLng?: number | null;
  radius?: number | null;
  baseAreaEnabled?: boolean;
}

const createDemandSite = (data: CreateDemandSiteVariables) =>
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
    baseAreaEnabled: boolean;
    isActive: boolean;
  }>;
}

const updateDemandSite = (id: number, data: UpdateDemandSiteVariables["data"]) =>
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

const listDemandSiteSchedules = (demandSiteId: number) =>
  request<DemandSiteSchedule[]>(`/api/demand-sites/${demandSiteId}/schedules`);

export const demandSiteSchedulesQueryOptions = (demandSiteId: number) =>
  queryOptions({
    queryKey: demandSiteKeys.schedules(demandSiteId),
    queryFn: () => listDemandSiteSchedules(demandSiteId),
  });

export interface CreateDemandSiteScheduleVariables {
  demandSiteId: number;
  data: { groupId: number };
}

const createDemandSiteSchedule = (
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

export interface DeleteDemandSiteScheduleVariables {
  scheduleId: number;
  demandSiteId: number;
}

const deleteDemandSiteSchedule = (scheduleId: number) =>
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

const listDemandSiteLocations = (demandSiteId: number) =>
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

const createDemandSiteLocation = (
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

// 💡 거점 위치 "수정" UI는 아직 없음 — 만들지 여부 아직 결정 안 됨. 그때까지 클라이언트에서
// 안 쓰이는 상태로 남아있는 게 정상.
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

const deleteDemandSiteLocation = (locationId: number) =>
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

export interface PromoteDemandSiteLocationVariables {
  locationId: number;
  demandSiteId: number;
  programId: number;
}

// 직접 그린 원형 거점을 수요처의 기본 관제구역으로 승격 — 그 거점은 삭제되고
// demandSites.baseLat/baseLng/radius가 그 값으로 바뀐다(worker의 /locations/:id/promote 참고).
const promoteDemandSiteLocation = (locationId: number) =>
  request<{ success: boolean }>(`/api/demand-sites/locations/${locationId}/promote`, {
    method: "POST",
  });

export const promoteDemandSiteLocationMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ locationId }: PromoteDemandSiteLocationVariables) =>
      promoteDemandSiteLocation(locationId),
    onSuccess: (_data, variables) => {
      // critical: 거점 목록(승격된 거점 삭제됨)과 수요처 자체(기본 관제구역 좌표 변경됨) 둘 다 갱신
      queryClient.invalidateQueries({ queryKey: demandSiteKeys.locations(variables.demandSiteId) });
      queryClient.invalidateQueries({ queryKey: demandSiteKeys.byProgram(variables.programId) });
    },
  });
