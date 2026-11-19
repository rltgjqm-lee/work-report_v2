import type { MobileZone } from "@work-report/admin-core/api/mobile";

export const hasArea = (zone: Pick<MobileZone, "radius" | "polygonCount">) =>
  zone.radius !== null || zone.polygonCount > 0;

// 관제 구역 몇 곳인지(기본 원 + 다각형) — "3곳" / "미설정"
export const areaLabel = (zone: Pick<MobileZone, "radius" | "polygonCount">) => {
  const count = (zone.radius !== null ? 1 : 0) + zone.polygonCount;
  return count === 0 ? "미설정" : `${count}곳`;
};
