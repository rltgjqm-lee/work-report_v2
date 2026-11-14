import type { MobileZone } from "@work-report/admin-core/api/mobile";

import { formatMeters } from "./format";

export const hasArea = (zone: Pick<MobileZone, "radius" | "polygonCount">) =>
  zone.radius !== null || zone.polygonCount > 0;

// "반경 1,500m + 다각형 2곳" / "미설정"
export const areaLabel = (zone: Pick<MobileZone, "radius" | "polygonCount">) => {
  const parts = [
    zone.radius !== null ? `반경 ${formatMeters(zone.radius)}` : null,
    zone.polygonCount > 0 ? `다각형 ${zone.polygonCount}곳` : null,
  ].filter(Boolean);
  return parts.length === 0 ? "미설정" : parts.join(" + ");
};
