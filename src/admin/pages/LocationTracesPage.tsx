import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

import { isoToKstTimeString } from "../../utils/timeFormat";

import {
  locationTraceDaysQueryOptions,
  locationTraceQueryOptions,
  type LocationTraceJudgement,
} from "../api/admin/locationTraces";
import FilterSelect from "../components/FilterSelect";

const JUDGEMENT_LABELS: Record<LocationTraceJudgement, string> = {
  INSIDE: "구역 안",
  OUTSIDE: "구역 밖",
  UNCERTAIN: "오차로 보류",
  NO_AREA: "관제구역 없음",
};

const JUDGEMENT_COLORS: Record<LocationTraceJudgement, string> = {
  INSIDE: "#3182f6",
  OUTSIDE: "#f04452",
  UNCERTAIN: "#f59f00",
  NO_AREA: "#8b95a1",
};

// FilterSelect 값 하나에 참여자와 날짜를 같이 담는다 — "32|2026-10-20"
const toDayKey = (participantId: number, workDate: string) => `${participantId}|${workDate}`;

/**
 * 관리자 페이지 > 이동 경로(시험) 페이지입니다. SUPER_ADMIN만 접근 가능합니다.
 * 허용 목록(LOCATION_TRACE_PARTICIPANT_IDS)에 넣은 참여자의 근무 중 위치 보고를 시간순으로 그립니다.
 *
 */
const LocationTracesPage = () => {
  const { data: days = [] } = useQuery(locationTraceDaysQueryOptions);
  const [selectedDayKey, setSelectedDayKey] = useState("");

  const activeDayKey =
    selectedDayKey || (days[0] ? toDayKey(days[0].participantId, days[0].workDate) : "");
  const [participantIdText, workDate] = activeDayKey ? activeDayKey.split("|") : [];

  const { data: trace, isPending: isTracePending } = useQuery(
    locationTraceQueryOptions(Number(participantIdText) || undefined, workDate),
  );
  const points = trace?.points ?? [];

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const traceLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([36.5, 127.8], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    traceLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = traceLayerRef.current;
    if (!map || !layer || !trace) return;

    layer.clearLayers();
    const boundsPoints: [number, number][] = [];

    const areaStyle = { color: "#3182f6", weight: 2, dashArray: "6 4", fillOpacity: 0.06 };
    trace.areas.forEach((area) => {
      if (area.shapeType === "RADIUS" && area.lat !== null && area.lng !== null && area.radius) {
        L.circle([area.lat, area.lng], { ...areaStyle, radius: area.radius }).addTo(layer);
        boundsPoints.push([area.lat, area.lng]);
      } else if (area.shapeType === "POLYGON" && area.polygon) {
        L.polygon(
          area.polygon.map((point) => [point.lat, point.lng] as [number, number]),
          areaStyle,
        ).addTo(layer);
        area.polygon.forEach((point) => boundsPoints.push([point.lat, point.lng]));
      }
    });

    const path = trace.points.map((point) => [point.lat, point.lng] as [number, number]);
    if (path.length > 1) {
      L.polyline(path, { color: "#333d4b", weight: 2, opacity: 0.6 }).addTo(layer);
    }
    trace.points.forEach((point, index) => {
      const color = JUDGEMENT_COLORS[point.judgement];
      if (point.accuracyM) {
        L.circle([point.lat, point.lng], {
          radius: point.accuracyM,
          color,
          weight: 1,
          opacity: 0.4,
          fillOpacity: 0.05,
        }).addTo(layer);
      }
      // 점 안에 순번을 적어 지도만 보고도 이동 순서를 알 수 있게 한다. 점이 겹치면
      // 나중 점이 위에 오도록 순번만큼 zIndexOffset을 준다.
      const icon = L.divIcon({
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;">${index + 1}</div>`,
      });
      L.marker([point.lat, point.lng], { icon, zIndexOffset: index })
        .bindTooltip(
          `#${index + 1} ${isoToKstTimeString(point.receivedAt)} · ${JUDGEMENT_LABELS[point.judgement]}` +
            (point.accuracyM !== null ? ` · 오차 ${Math.round(point.accuracyM)}m` : ""),
        )
        .addTo(layer);
    });
    boundsPoints.push(...path);

    if (boundsPoints.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40], maxZoom: 17 });
    }
  }, [trace]);

  const dayOptions = days.map((day) => ({
    value: toDayKey(day.participantId, day.workDate),
    label: `${day.workDate} · ${day.participantName} (${day.programName}) · ${day.pointCount}건`,
  }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[21px] font-bold m-0">이동 경로 (시험)</h1>
        <p className="text-[13px] text-text-subtle mt-1.5">
          시험 대상 참여자가 근무 중 보낸 위치(약 10분 간격)를 시간순으로 표시합니다. 앱이 위치를
          보내지 못한 구간은 비어 있습니다.
        </p>
      </div>

      <div className="mb-3">
        {dayOptions.length > 0 ? (
          <FilterSelect
            value={activeDayKey}
            onChange={setSelectedDayKey}
            options={dayOptions}
            className="w-full max-w-[520px]"
          />
        ) : (
          <p className="text-[13px] text-text-subtle">아직 기록된 경로가 없습니다.</p>
        )}
      </div>

      <div
        ref={mapContainerRef}
        className="h-[480px] w-full border border-admin-border-subtle rounded-[2px] mb-4"
      />

      {trace && (
        <div className="bg-white border border-admin-border-subtle rounded-[2px]">
          <div className="px-5 py-3 text-[13px] border-b border-admin-border-subtle">
            수요처: {trace.demandSiteName ?? "미배정"}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  {["#", "수신 시각", "측위 시각", "판정", "출처", "오차", "고도", "좌표"].map(
                    (header) => (
                      <th
                        key={header}
                        className="text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {points.map((point, index) => (
                  <tr key={point.id} className="hover:bg-admin-row-hover">
                    <td className="px-5 py-[11px] text-[13px] border-b border-border-faint">
                      {index + 1}
                    </td>
                    <td className="px-5 py-[11px] text-[13px] border-b border-border-faint">
                      {isoToKstTimeString(point.receivedAt)}
                    </td>
                    <td className="px-5 py-[11px] text-[13px] border-b border-border-faint">
                      {point.locatedAt ? isoToKstTimeString(point.locatedAt) : "-"}
                    </td>
                    <td
                      className="px-5 py-[11px] text-[13px] border-b border-border-faint"
                      style={{ color: JUDGEMENT_COLORS[point.judgement] }}
                    >
                      {JUDGEMENT_LABELS[point.judgement]}
                      {point.simulated && " · 위치 조작 의심"}
                    </td>
                    <td className="px-5 py-[11px] text-[13px] border-b border-border-faint">
                      {point.locationSource === "GPS"
                        ? "GPS"
                        : point.locationSource === "NETWORK"
                          ? "와이파이·기지국"
                          : "-"}
                    </td>
                    <td className="px-5 py-[11px] text-[13px] border-b border-border-faint">
                      {point.accuracyM !== null ? `${Math.round(point.accuracyM)}m` : "-"}
                    </td>
                    <td className="px-5 py-[11px] text-[13px] border-b border-border-faint">
                      {point.altitudeM !== null ? `${Math.round(point.altitudeM)}m` : "-"}
                    </td>
                    <td className="px-5 py-[11px] text-[13px] border-b border-border-faint whitespace-nowrap">
                      {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!trace && isTracePending && activeDayKey && (
        <p className="text-[13px] text-text-subtle">불러오는 중...</p>
      )}
    </div>
  );
};

export default LocationTracesPage;
