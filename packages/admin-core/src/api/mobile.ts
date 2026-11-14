import { queryOptions } from "@tanstack/react-query";

import { request } from "../client";

// 관리자 앱(apps/admin-mobile) 전용 조회 — 담당 사업단 전체를 한 번에 모아 받는다(/api/mobile).
// 처리(resolve)는 PC와 같은 sos.ts / escapes.ts의 뮤테이션을 쓰고, 그 뮤테이션이 이 파일의
// 키(mobileKeys.all)도 같이 무효화한다.
// 시각(triggeredAt·detectedAt·resolvedAt·lastLocationAt)은 전부 진짜 UTC ISO라
// new Date()로 읽어 폰 시간대로 보여주면 된다.

export type MobileSos = {
  id: number;
  programId: number;
  participantName: string;
  programName: string;
  groupName: string | null;
  demandSiteName: string | null;
  triggeredAt: string;
  lat: number | null;
  lng: number | null;
  // 요청 순간 위치가 관제구역 경계 밖으로 나간 거리(m). 0이면 구역 안, null이면 판정 불가
  outsideM: number | null;
  status: "OPEN" | "RESOLVED";
  resolvedAt: string | null;
  resolverName: string | null;
  memo: string | null;
};

export type MobileEscape = {
  id: number;
  programId: number;
  participantName: string;
  programName: string;
  groupName: string | null;
  demandSiteName: string | null;
  detectedAt: string;
  // 이탈로 판정한 순간 경계 밖 거리(m)
  detectedOutsideM: number;
  // 진행 중일 때 마지막 위치 보고 기준 경계 밖 거리(m) — 0이면 구역 안으로 돌아옴, null이면 모름
  currentOutsideM: number | null;
  lastLocationAt: string | null;
  lat: number;
  lng: number;
  alertCount: number;
  status: "OPEN" | "RESOLVED";
  resolvedAt: string | null;
  resolverName: string | null;
  memo: string | null;
};

export type MobileArea = {
  shapeType: "RADIUS" | "POLYGON";
  lat: number | null;
  lng: number | null;
  radius: number | null;
  polygon: { lat: number; lng: number }[] | null;
};

export type MobileSafety = {
  sos: MobileSos[];
  escapes: MobileEscape[];
};

export type MobileHome = {
  organizationName: string | null;
  todayClockInCount: number;
  zoneCount: number;
  escapeZoneCount: number;
};

export type MobileZone = {
  id: number;
  name: string;
  address: string | null;
  programName: string;
  // 기본 원을 관제에 쓸 때만 반경(m), 다각형만 쓰면 null
  radius: number | null;
  polygonCount: number;
  scheduleLabel: string | null;
  assignedCount: number;
  workingCount: number;
  escapeCount: number;
};

export type MobileZoneMemberState =
  "INSIDE" | "ESCAPE" | "UNCERTAIN" | "NOT_CLOCKED_IN" | "CLOCKED_OUT";

export type MobileZoneMember = {
  participantId: number;
  name: string;
  groupName: string | null;
  state: MobileZoneMemberState;
  clockInTime: string | null;
  clockOutTime: string | null;
  lat: number | null;
  lng: number | null;
  lastLocationAt: string | null;
  outsideM: number | null;
};

export type MobileZoneDetail = {
  zone: MobileZone;
  escapeTodayCount: number;
  areas: MobileArea[];
  members: MobileZoneMember[];
};

export const mobileKeys = {
  all: ["mobile"] as const,
  safety: () => [...mobileKeys.all, "safety"] as const,
  sosDetail: (sosId: number) => [...mobileKeys.all, "sos", sosId] as const,
  escapeDetail: (escapeId: number) => [...mobileKeys.all, "escape", escapeId] as const,
  home: () => [...mobileKeys.all, "home"] as const,
  zones: () => [...mobileKeys.all, "zones"] as const,
  zoneDetail: (zoneId: number) => [...mobileKeys.all, "zone", zoneId] as const,
};

// 알림을 놓쳐도 화면을 켜두면 따라오도록 30초마다 다시 받는다. 앱이 백그라운드면
// TanStack Query가 알아서 멈추고, 알림을 받거나 앱으로 돌아오면 바로 다시 받는다.
const SAFETY_REFETCH_INTERVAL_MS = 30 * 1000;

const getMobileSafety = () => request<MobileSafety>("/api/mobile/safety");

export const mobileSafetyQueryOptions = queryOptions({
  queryKey: mobileKeys.safety(),
  queryFn: getMobileSafety,
  refetchInterval: SAFETY_REFETCH_INTERVAL_MS,
});

const getMobileSosDetail = (sosId: number) =>
  request<{ sos: MobileSos; areas: MobileArea[] }>(`/api/mobile/sos/${sosId}`);

export const mobileSosDetailQueryOptions = (sosId: number) =>
  queryOptions({
    queryKey: mobileKeys.sosDetail(sosId),
    queryFn: () => getMobileSosDetail(sosId),
    enabled: Number.isFinite(sosId) && sosId > 0,
  });

const getMobileEscapeDetail = (escapeId: number) =>
  request<{ escape: MobileEscape; areas: MobileArea[] }>(`/api/mobile/escapes/${escapeId}`);

export const mobileEscapeDetailQueryOptions = (escapeId: number) =>
  queryOptions({
    queryKey: mobileKeys.escapeDetail(escapeId),
    queryFn: () => getMobileEscapeDetail(escapeId),
    enabled: Number.isFinite(escapeId) && escapeId > 0,
    refetchInterval: SAFETY_REFETCH_INTERVAL_MS,
  });

const getMobileHome = () => request<MobileHome>("/api/mobile/home");

export const mobileHomeQueryOptions = queryOptions({
  queryKey: mobileKeys.home(),
  queryFn: getMobileHome,
  refetchInterval: SAFETY_REFETCH_INTERVAL_MS,
});

const getMobileZones = () => request<{ zones: MobileZone[] }>("/api/mobile/zones");

export const mobileZonesQueryOptions = queryOptions({
  queryKey: mobileKeys.zones(),
  queryFn: getMobileZones,
  select: (data) => data.zones,
});

const getMobileZoneDetail = (zoneId: number) =>
  request<MobileZoneDetail>(`/api/mobile/zones/${zoneId}`);

export const mobileZoneDetailQueryOptions = (zoneId: number) =>
  queryOptions({
    queryKey: mobileKeys.zoneDetail(zoneId),
    queryFn: () => getMobileZoneDetail(zoneId),
    enabled: Number.isFinite(zoneId) && zoneId > 0,
    refetchInterval: SAFETY_REFETCH_INTERVAL_MS,
  });
