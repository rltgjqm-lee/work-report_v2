import { request } from "../client";
import type { DemandSite, DemandSiteSchedule } from "../../types";

export const listDemandSites = (programId: number) =>
  request<DemandSite[]>(`/api/demand-sites?programId=${programId}`);

export const createDemandSite = (data: {
  programId: number;
  name: string;
  baseLat: number;
  baseLng: number;
  allowedRadius?: number;
  address?: string;
  contactPerson?: string;
}) =>
  request<DemandSite>("/api/demand-sites", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateDemandSite = (
  id: number,
  data: Partial<{
    name: string;
    baseLat: number;
    baseLng: number;
    allowedRadius: number;
    address: string;
    contactPerson: string;
    isActive: boolean;
  }>,
) =>
  request<DemandSite>(`/api/demand-sites/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const listDemandSiteSchedules = (demandSiteId: number) =>
  request<DemandSiteSchedule[]>(`/api/demand-sites/${demandSiteId}/schedules`);

export const createDemandSiteSchedule = (
  demandSiteId: number,
  data: { groupId: number; shiftStart: string; shiftEnd: string },
) =>
  request<DemandSiteSchedule>(`/api/demand-sites/${demandSiteId}/schedules`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateDemandSiteSchedule = (
  scheduleId: number,
  data: Partial<{ shiftStart: string; shiftEnd: string }>,
) =>
  request<DemandSiteSchedule>(`/api/demand-sites/schedules/${scheduleId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteDemandSiteSchedule = (scheduleId: number) =>
  request<{ success: boolean }>(`/api/demand-sites/schedules/${scheduleId}`, {
    method: "DELETE",
  });
