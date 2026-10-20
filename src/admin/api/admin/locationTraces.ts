import { queryOptions } from "@tanstack/react-query";

import { request } from "../client";

// 이동 경로 시험 기록(SUPER_ADMIN 전용) — worker/src/routes/admin/locationTraces.ts

export type LocationTraceDay = {
  participantId: number;
  participantName: string;
  programName: string;
  workDate: string;
  pointCount: number;
};

export type LocationTraceJudgement = "INSIDE" | "OUTSIDE" | "UNCERTAIN" | "NO_AREA";

export type LocationTracePoint = {
  id: number;
  receivedAt: string;
  locatedAt: string | null;
  lat: number;
  lng: number;
  accuracyM: number | null;
  altitudeM: number | null;
  simulated: boolean;
  locationSource: "GPS" | "NETWORK" | null;
  judgement: LocationTraceJudgement;
};

export type LocationTraceArea = {
  shapeType: "RADIUS" | "POLYGON";
  lat: number | null;
  lng: number | null;
  radius: number | null;
  polygon: { lat: number; lng: number }[] | null;
};

export type LocationTrace = {
  demandSiteName: string | null;
  areas: LocationTraceArea[];
  points: LocationTracePoint[];
};

const listLocationTraceDays = () => request<LocationTraceDay[]>("/api/location-traces/days");

const getLocationTrace = (participantId: number, workDate: string) =>
  request<LocationTrace>(
    `/api/location-traces?participantId=${participantId}&workDate=${workDate}`,
  );

const locationTraceKeys = {
  all: ["location-traces"] as const,
  days: () => [...locationTraceKeys.all, "days"] as const,
  detail: (participantId: number, workDate: string) =>
    [...locationTraceKeys.all, participantId, workDate] as const,
};

export const locationTraceDaysQueryOptions = queryOptions({
  queryKey: locationTraceKeys.days(),
  queryFn: listLocationTraceDays,
});

export const locationTraceQueryOptions = (
  participantId: number | undefined,
  workDate: string | undefined,
) =>
  queryOptions({
    queryKey: locationTraceKeys.detail(participantId ?? 0, workDate ?? ""),
    queryFn: () => getLocationTrace(participantId as number, workDate as string),
    enabled: !!participantId && !!workDate,
  });
