import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { demandSiteLocations, demandSites } from "../db/schema";
import { distanceOutsidePolygonM, haversineKm, isPointInPolygon, polygonCentroid } from "./geo";

type Database = ReturnType<typeof drizzle>;

// 판정 대상 관제구역 — 수요처 하위 거점(demand_site_locations)과, 거점을 안 그려도
// 관제되도록 수요처 자체에 잡아둔 기본 원(demand_sites.baseLat/baseLng/radius)을
// 같은 모양으로 다룬다. 이탈 관제(/public/location)와 출퇴근 위치 기록이 같은 구역을 쓴다.
export type GeofenceArea = {
  shapeType: "RADIUS" | "POLYGON";
  baseLat: number | null;
  baseLng: number | null;
  radius: number | null;
  polygon: string | null;
};

// 좌표가 관제구역 하나(원형 or 다각형) 안에 있는지 판정
export const isInsideArea = (lat: number, lng: number, area: GeofenceArea): boolean => {
  if (area.shapeType === "RADIUS") {
    if (area.baseLat === null || area.baseLng === null || area.radius === null) {
      return false;
    }
    return haversineKm(lat, lng, area.baseLat, area.baseLng) <= area.radius / 1000;
  }
  if (!area.polygon) return false;
  const polygon = JSON.parse(area.polygon) as { lat: number; lng: number }[];
  return isPointInPolygon({ lat, lng }, polygon);
};

// 가장 가까운 구역까지의 거리(km) — 원형은 중심, 다각형은 중심점 기준의 대략적인 값.
// 이탈 로그의 distanceKm과 출퇴근 기록의 distanceM이 같은 기준을 쓰도록 여기서만 계산한다.
export const distanceToNearestArea = (lat: number, lng: number, areas: GeofenceArea[]): number => {
  const distances = areas.map((area) => {
    if (area.shapeType === "RADIUS") {
      if (area.baseLat === null || area.baseLng === null) return Infinity;
      return haversineKm(lat, lng, area.baseLat, area.baseLng);
    }
    if (!area.polygon) return Infinity;
    const polygon = JSON.parse(area.polygon) as { lat: number; lng: number }[];
    const centroid = polygonCentroid(polygon);
    return haversineKm(lat, lng, centroid.lat, centroid.lng);
  });
  return Math.min(...distances);
};

// 좌표가 관제구역 밖으로 얼마나 나가 있는지(m) — 구역 하나라도 안에 있으면 0.
// distanceToNearestArea(중심까지의 거리)와 달리 "경계를 얼마나 넘었는가"라서,
// GPS 오차와 직접 비교해 이탈을 단정해도 되는지 판단할 수 있다.
export const distanceOutsideAreasM = (lat: number, lng: number, areas: GeofenceArea[]): number => {
  const distances = areas.map((area) => {
    if (area.shapeType === "RADIUS") {
      if (area.baseLat === null || area.baseLng === null || area.radius === null) {
        return Infinity;
      }
      const centerDistanceM = haversineKm(lat, lng, area.baseLat, area.baseLng) * 1000;
      return Math.max(0, centerDistanceM - area.radius);
    }
    if (!area.polygon) return Infinity;
    const polygon = JSON.parse(area.polygon) as { lat: number; lng: number }[];
    return distanceOutsidePolygonM({ lat, lng }, polygon);
  });
  return Math.min(...distances);
};

// 수요처 기본 원 + 하위 거점을 하나의 구역 목록으로 합친다.
// 둘 다 있으면 어느 한 곳 안에만 있어도 정상 근무로 본다.
export const buildDemandSiteAreas = (
  demandSite: {
    baseLat: number | null;
    baseLng: number | null;
    radius: number | null;
    baseAreaEnabled: boolean;
  },
  locations: GeofenceArea[],
): GeofenceArea[] => {
  const areas: GeofenceArea[] = [...locations];
  if (
    demandSite.baseAreaEnabled &&
    demandSite.baseLat !== null &&
    demandSite.baseLng !== null &&
    demandSite.radius !== null
  ) {
    areas.push({
      shapeType: "RADIUS",
      baseLat: demandSite.baseLat,
      baseLng: demandSite.baseLng,
      radius: demandSite.radius,
      polygon: null,
    });
  }
  return areas;
};

// 출퇴근 위치를 기록할 때 쓰는 판정 결과.
// 좌표가 없거나 수요처/관제구역이 없어서 판정 자체를 못 하면 둘 다 null이다 —
// "구역 밖(false)"과 "판정 불가(null)"를 반드시 구분해서 저장해야 한다.
export type PositionCheck = {
  inside: boolean | null;
  distanceM: number | null;
};

const UNKNOWN_POSITION: PositionCheck = {
  inside: null,
  distanceM: null,
};

// 참여자가 배정된 수요처의 관제구역 기준으로 좌표를 평가한다.
// 판정에 실패할 이유가 많아서(좌표 없음/수요처 미배정/구역 미등록) 전부 null로 흡수하고,
// 호출부(출퇴근)는 이 결과로 흐름을 막지 않는다.
export const checkPositionAgainstDemandSite = async (
  db: Database,
  demandSiteId: number | null,
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<PositionCheck> => {
  if (
    demandSiteId === null ||
    lat === null ||
    lat === undefined ||
    lng === null ||
    lng === undefined
  ) {
    return UNKNOWN_POSITION;
  }

  const demandSiteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, demandSiteId));
  const demandSite = demandSiteRows[0];
  if (!demandSite) return UNKNOWN_POSITION;

  const locations = await db
    .select()
    .from(demandSiteLocations)
    .where(eq(demandSiteLocations.demandSiteId, demandSiteId));

  const areas = buildDemandSiteAreas(demandSite, locations);
  if (areas.length === 0) return UNKNOWN_POSITION;

  return {
    inside: areas.some((area) => isInsideArea(lat, lng, area)),
    distanceM: Math.round(distanceToNearestArea(lat, lng, areas) * 1000),
  };
};
