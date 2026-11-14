import { useEffect, useRef } from "react";

import L from "leaflet";

import type { MobileArea } from "@work-report/admin-core/api/mobile";

export type MapPoint = {
  lat: number;
  lng: number;
  tone: "sos" | "escape" | "inside" | "muted";
  label?: string;
};

const POINT_COLORS: Record<MapPoint["tone"], string> = {
  sos: "#dc2626",
  escape: "#ea580c",
  inside: "#16a34a",
  muted: "#9ca3af",
};

const AREA_STYLE: L.PathOptions = {
  color: "#1e3a5f",
  weight: 2,
  fillColor: "#1e3a5f",
  fillOpacity: 0.12,
};

type SafetyMapProps = {
  areas: MobileArea[];
  points: MapPoint[];
  ariaLabel: string;
  className?: string;
};

// 관제구역(원·다각형)과 참여자 위치를 지도에 그린다. 지도를 손으로 움직일 수는 있지만
// 화면이 다시 그려지면(30초 갱신) 구역과 위치가 다 보이게 다시 맞춘다.
const SafetyMap = ({ areas, points, ariaLabel, className = "h-56" }: SafetyMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // 부모가 다시 그려질 때마다(메모 입력, 경과 시간 갱신) 새 배열이 들어와도, 구역·위치가
  // 실제로 바뀌었을 때만 지도를 다시 그리고 맞춘다
  const shapeSignature = JSON.stringify({ areas, points });

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds = L.latLngBounds([]);
    areas.forEach((area) => {
      if (area.shapeType === "RADIUS" && area.lat !== null && area.lng !== null && area.radius) {
        L.circle([area.lat, area.lng], { ...AREA_STYLE, radius: area.radius }).addTo(layer);
        // circle.getBounds()는 지도가 처음 위치를 잡기 전엔 못 쓴다 — 중심과 반경으로 직접 계산한다
        bounds.extend(L.latLng(area.lat, area.lng).toBounds(area.radius * 2));
      }
      if (area.shapeType === "POLYGON" && area.polygon && area.polygon.length >= 3) {
        const polygon = L.polygon(
          area.polygon.map((point) => [point.lat, point.lng] as L.LatLngTuple),
          AREA_STYLE,
        );
        polygon.addTo(layer);
        bounds.extend(polygon.getBounds());
      }
    });
    points.forEach((point) => {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: POINT_COLORS[point.tone],
        fillOpacity: 1,
      });
      if (point.label) marker.bindTooltip(point.label, { direction: "top", offset: [0, -8] });
      marker.addTo(layer);
      bounds.extend([point.lat, point.lng]);
    });

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
    else map.setView([37.5665, 126.978], 11);
    // shapeSignature가 areas·points 내용을 대신한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeSignature]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={`relative z-0 w-full overflow-hidden rounded-[18px] bg-map ${className}`}
    />
  );
};

export default SafetyMap;
