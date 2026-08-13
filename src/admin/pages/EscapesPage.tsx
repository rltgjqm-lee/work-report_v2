import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

import { isoToKstMinuteString, isoToKstTimeString } from "../../utils/timeFormat";
import { useToast } from "../context/useToast";

import { demandSiteLocationsQueryOptions, demandSitesQueryOptions } from "../api/admin/demandSites";
import {
  escapesQueryOptions,
  liveWorkersQueryOptions,
  markEscapeAlertedMutationOptions,
  resolveEscapeMutationOptions,
} from "../api/admin/escapes";
import { programQueryOptions, programsQueryOptions } from "../api/admin/programs";
import FilterSelect from "../components/FilterSelect";
import PromptModal from "../components/modal/PromptModal";
import SearchInput from "../components/SearchInput";
import type { DemandSiteLocation } from "../types/demandSites";
import type { EscapeRow, EscapeStatus, LiveWorker } from "../types/escapes";

// 수요처별 관제구역 — 지도에 그릴 때 어느 수요처 것인지 알아야 필터가 걸린다.
// location이 null이면 거점이 아니라 수요처 자체에 잡아둔 기본 원이다.
interface DemandSiteGeofence {
  demandSiteId: number;
  demandSiteName: string;
  location: DemandSiteLocation | null;
  baseArea: { lat: number; lng: number; radius: number } | null;
}

const POLL_INTERVAL_MS = 10000;

// 3단계 신호등 — alertCount 기준 (설계의 outside_minutes는 이번 구현에서 안 씀)
const getMarkerColor = (worker: LiveWorker): string => {
  if (worker.alertCount >= 3) return "#FF0000";
  if (worker.alertCount >= 2) return "#FF7800";
  if (worker.alertCount >= 1) return "#FFD200";
  return "#2ECC71";
};

/**
 * 관리자 페이지 > 안전 관제 페이지입니다.
 *
 */
const EscapesPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const preselectedProgramId = id ? Number(id) : null;

  const [programTypeFilter, setProgramTypeFilter] = useState("all");
  const [selectedProgramId, setSelectedProgramId] = useState<string>(id ?? "");
  const [status, setStatus] = useState<EscapeStatus>("OPEN");
  const [search, setSearch] = useState("");
  const [criticalEscape, setCriticalEscape] = useState<EscapeRow | null>(null);
  const [lowerTierEscapeAlert, setLowerTierEscapeAlert] = useState<{
    row: EscapeRow;
    tier: 1 | 2;
  } | null>(null);
  const [resolveTarget, setResolveTarget] = useState<{
    escapeId: number;
    participantName: string;
  } | null>(null);
  const [selectedDemandSiteId, setSelectedDemandSiteId] = useState("");
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);

  const programId = preselectedProgramId ?? Number(selectedProgramId);

  // 사이드바로 바로 들어온 경우(사업단 id 없음) 고를 수 있게 전체 사업단 목록을 가져온다
  const { data: programs = [] } = useQuery({
    ...programsQueryOptions,
    enabled: !preselectedProgramId,
  });
  const { data: preselectedProgram } = useQuery({
    ...programQueryOptions(preselectedProgramId ?? 0),
    enabled: !!preselectedProgramId,
  });
  const programName = preselectedProgram?.name ?? "";

  const filteredPrograms = useMemo(
    () =>
      programTypeFilter === "all"
        ? programs
        : programs.filter((program) => program.programType === programTypeFilter),
    [programs, programTypeFilter],
  );

  // OPEN은 위급 이탈 감지를 위해 항상 폴링하고, RESOLVED는 상태 탭을 볼 때만 조회한다.
  const { data: openEscapes = [] } = useQuery({
    ...escapesQueryOptions(programId, "OPEN"),
    enabled: !!programId,
    refetchInterval: POLL_INTERVAL_MS,
  });
  const { data: resolvedEscapes = [] } = useQuery({
    ...escapesQueryOptions(programId, "RESOLVED"),
    enabled: !!programId && status === "RESOLVED",
  });
  const rows = status === "OPEN" ? openEscapes : resolvedEscapes;

  const { data: workers = [] } = useQuery({
    ...liveWorkersQueryOptions(programId),
    enabled: !!programId,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const { data: demandSites = [] } = useQuery({
    ...demandSitesQueryOptions(programId),
    enabled: !!programId,
  });
  const demandSiteLocationQueries = useQueries({
    queries: demandSites.map((demandSite) => demandSiteLocationsQueryOptions(demandSite.id)),
  });
  const geofences = useMemo(
    () =>
      demandSites.flatMap((demandSite, index) => {
        const locations = demandSiteLocationQueries[index]?.data ?? [];
        const siteGeofences: DemandSiteGeofence[] = locations.map((location) => ({
          demandSiteId: demandSite.id,
          demandSiteName: demandSite.name,
          location,
          baseArea: null,
        }));

        // 거점을 안 그린 수요처도 기본 관제구역이 활성화되어 있으면 지도에 나와야 한다
        if (
          demandSite.baseAreaEnabled &&
          demandSite.baseLat !== null &&
          demandSite.baseLng !== null &&
          demandSite.radius !== null
        ) {
          siteGeofences.push({
            demandSiteId: demandSite.id,
            demandSiteName: demandSite.name,
            location: null,
            baseArea: {
              lat: demandSite.baseLat,
              lng: demandSite.baseLng,
              radius: demandSite.radius,
            },
          });
        }

        return siteGeofences;
      }),
    [demandSites, demandSiteLocationQueries],
  );

  const resolveEscapeMutation = useMutation(resolveEscapeMutationOptions(queryClient));
  const markEscapeAlertedMutation = useMutation(markEscapeAlertedMutationOptions(queryClient));

  // 새로 다음 단계(1/2/3단계)로 악화된 이탈을 감지해 팝업 — openEscapes가 폴링될 때마다
  // 확인한다. alertedAtCount가 서버에 남아있어 새로고침해도 같은 단계로는 다시 안 뜨고,
  // 더 악화될 때만(alertCount가 alertedAtCount를 넘어설 때) 다시 뜬다.
  useEffect(() => {
    const next = openEscapes.find((row) => row.escape.alertCount > row.escape.alertedAtCount);
    if (!next) return;

    if (next.escape.alertCount >= 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 폴링된 서버 상태를 감지해 팝업을 띄운다
      setCriticalEscape(next);
    } else {
      setLowerTierEscapeAlert({ row: next, tier: next.escape.alertCount >= 2 ? 2 : 1 });
    }
    markEscapeAlertedMutation.mutate({ escapeId: next.escape.id, programId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEscapes]);

  const filteredWorkers = useMemo(
    () =>
      workers.filter(
        (worker) =>
          worker.name.includes(search) &&
          (!selectedDemandSiteId || String(worker.demandSiteId) === selectedDemandSiteId),
      ),
    [workers, search, selectedDemandSiteId],
  );

  // 이탈 목록에는 수요처 id가 없고 이름만 내려온다 — 선택한 수요처 이름으로 맞춘다
  const filteredRows = useMemo(() => {
    if (!selectedDemandSiteId) return rows;

    const selectedDemandSite = demandSites.find(
      (demandSite) => String(demandSite.id) === selectedDemandSiteId,
    );

    return rows.filter((row) => row.demandSiteName === selectedDemandSite?.name);
  }, [rows, demandSites, selectedDemandSiteId]);

  const visibleGeofences = useMemo(
    () =>
      geofences.filter(
        (geofence) =>
          !selectedDemandSiteId || String(geofence.demandSiteId) === selectedDemandSiteId,
      ),
    [geofences, selectedDemandSiteId],
  );

  // 지도 초기화 — 사이드바로 진입해 사업단 미선택 상태면 지도 컨테이너 자체가 아직
  // 렌더링 안 됐으므로, programId가 정해져 컨테이너가 나타난 뒤에 초기화한다
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([36.5, 127.8], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    geofenceLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [programId]);

  // 관제구역(원형/다각형) 그리기 — 수요처 필터가 바뀌면 다시 그린다.
  // 근무자 위치가 아직 없을 때는 관제구역 쪽으로 지도를 맞춰준다.
  useEffect(() => {
    const map = mapRef.current;
    const layer = geofenceLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const shapeStyle = {
      color: "#3182f6",
      weight: 2,
      dashArray: "6 4",
      fillOpacity: 0.06,
    };
    const points: [number, number][] = [];

    visibleGeofences.forEach(({ demandSiteName, location, baseArea }) => {
      if (baseArea) {
        points.push([baseArea.lat, baseArea.lng]);
        L.circle([baseArea.lat, baseArea.lng], {
          ...shapeStyle,
          radius: baseArea.radius,
        })
          .bindTooltip(`${demandSiteName} 기본 관제구역`)
          .addTo(layer);

        return;
      }
      if (!location) return;

      const tooltipLabel = `${demandSiteName} · ${location.name}`;

      if (
        location.shapeType === "RADIUS" &&
        location.baseLat !== null &&
        location.baseLng !== null &&
        location.radius !== null
      ) {
        points.push([location.baseLat, location.baseLng]);
        L.circle([location.baseLat, location.baseLng], {
          ...shapeStyle,
          radius: location.radius,
        })
          .bindTooltip(tooltipLabel)
          .addTo(layer);
      } else if (location.shapeType === "POLYGON" && location.polygon) {
        location.polygon.forEach((point) => points.push([point.lat, point.lng]));
        L.polygon(
          location.polygon.map((point) => [point.lat, point.lng] as [number, number]),
          shapeStyle,
        )
          .bindTooltip(tooltipLabel)
          .addTo(layer);
      }
    });

    const hasLocatedWorker = filteredWorkers.some(
      (worker) => worker.lat !== null && worker.lng !== null,
    );
    if (points.length > 0 && !hasLocatedWorker) {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 16 });
    }
    // filteredWorkers는 지도를 어디에 맞출지 판단할 때만 쓴다 — 근무자가 갱신될
    // 때마다 관제구역을 다시 그릴 필요는 없어서 의존성에서 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleGeofences, programId]);

  // 근무자 목록이 바뀔 때마다 마커 다시 그리기
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const located = filteredWorkers.filter(
      (worker): worker is LiveWorker & { lat: number; lng: number } =>
        worker.lat !== null && worker.lng !== null,
    );

    located.forEach((worker) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${getMarkerColor(
          worker,
        )};border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4);"></div>`,
      });
      const marker = L.marker([worker.lat, worker.lng], { icon });
      marker.bindPopup(
        `<strong>${worker.name}</strong><br/>` +
          `상태: ${worker.status === "ESCAPE" ? "이탈중" : "정상"}<br/>` +
          `이탈횟수: ${worker.alertCount}회<br/>` +
          `수요처: ${worker.demandSiteName}<br/>` +
          `마지막 위치: ${worker.lastLocationAt ? isoToKstTimeString(worker.lastLocationAt) : "-"}`,
      );
      marker.addTo(layer);
    });

    if (located.length > 0) {
      const bounds = L.latLngBounds(
        located.map((worker) => [worker.lat, worker.lng] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [filteredWorkers]);

  const handleResolveButtonClick = (escapeId: number, participantName: string) => {
    setResolveTarget({ escapeId, participantName });
  };

  const handleResolvePromptConfirm = (memo: string) => {
    if (!resolveTarget) return;
    const { escapeId, participantName } = resolveTarget;
    setResolveTarget(null);

    resolveEscapeMutation.mutate(
      { escapeId, programId, memo: memo || undefined },
      {
        onSuccess: () => showToast(`'${participantName}' 님의 이탈을 확인 처리했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleResolveCriticalButtonClick = () => {
    if (!criticalEscape) return;

    resolveEscapeMutation.mutate(
      { escapeId: criticalEscape.escape.id, programId },
      {
        onSuccess: () => {
          showToast(`'${criticalEscape.participantName}' 님의 이탈을 확인 처리했습니다.`);
          setCriticalEscape(null);
        },
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleProgramTypeFilterChange = (value: string) => {
    setProgramTypeFilter(value);
    setSelectedProgramId("");
    setSelectedDemandSiteId("");
  };

  const handleProgramFilterChange = (value: string) => {
    setSelectedProgramId(value);
    setSelectedDemandSiteId("");
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          {preselectedProgramId ? (
            <div className="text-xs text-text-subtle mb-1.5">
              사업단 관리 /{" "}
              <a
                onClick={() => navigate(`/admin/programs/${preselectedProgramId}`)}
                className="cursor-pointer text-admin-brand hover:text-admin-brand-dark"
              >
                {programName || "사업단 상세"}
              </a>{" "}
              / 안전 관제
            </div>
          ) : null}
          <h1 className="text-[21px] font-bold m-0">안전 관제</h1>
        </div>
        <div className="flex items-center gap-2.5">
          {!preselectedProgramId && (
            <FilterSelect
              value={programTypeFilter}
              onChange={handleProgramTypeFilterChange}
              options={[
                { value: "all", label: "전체 유형" },
                { value: "공익 활동", label: "공익 활동" },
                { value: "역량 활동", label: "역량 활동" },
              ]}
            />
          )}
          {!preselectedProgramId && (
            <FilterSelect
              value={selectedProgramId}
              onChange={handleProgramFilterChange}
              options={[
                { value: "", label: "사업단을 선택하세요" },
                ...filteredPrograms.map((program) => ({
                  value: String(program.id),
                  label: program.name,
                })),
              ]}
            />
          )}
          <FilterSelect
            value={selectedDemandSiteId}
            onChange={setSelectedDemandSiteId}
            disabled={!programId}
            options={[
              { value: "", label: "전체 수요처" },
              ...demandSites.map((demandSite) => ({
                value: String(demandSite.id),
                label: demandSite.name,
              })),
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 참여자 이름 검색" />
          <FilterSelect
            value={status}
            onChange={(value) => setStatus(value as EscapeStatus)}
            options={[
              { value: "OPEN", label: "확인 필요" },
              { value: "RESOLVED", label: "처리 완료" },
            ]}
          />
        </div>
      </div>

      {!programId ? (
        <div className="bg-white border border-admin-border-subtle rounded-[2px] px-5 py-10 text-center text-[13px] text-admin-text-placeholder">
          조회할 사업단을 선택해주세요.
        </div>
      ) : (
        <>
          <div className="flex gap-3 items-start">
            <div
              ref={mapContainerRef}
              className="h-[calc(100vh-190px)] flex-[2] border border-admin-border-subtle rounded-[2px]"
            />
            <div className="flex-1 min-w-[420px] flex flex-col gap-3">
              <div className="bg-white border border-admin-border-subtle rounded-[2px] px-4 py-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-text-subtle mb-3">
                  이탈 단계
                </div>
                <div className="flex items-center gap-4 text-[13px] flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-admin-map-safe flex-none" />
                    정상
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-admin-map-caution flex-none" />
                    1단계
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-admin-map-warning flex-none" />
                    2단계
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-admin-map-critical flex-none" />
                    3단계
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-dashed border-brand flex-none" />
                    관제구역
                  </div>
                  <div className="text-text-subtle ml-auto">근무중 {filteredWorkers.length}명</div>
                </div>
              </div>

              <div className="bg-white border border-admin-border-subtle rounded-[2px] flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto max-h-[640px]">
                  <table className="w-full min-w-[560px] table-fixed border-collapse">
                    <thead>
                      <tr>
                        <th className="w-[130px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-3 py-[11px] border-b border-admin-border-subtle">
                          감지시각
                        </th>
                        <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-3 py-[11px] border-b border-admin-border-subtle">
                          참여자명
                        </th>
                        <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-3 py-[11px] border-b border-admin-border-subtle">
                          이탈거리
                        </th>
                        <th className="w-[70px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-3 py-[11px] border-b border-admin-border-subtle">
                          단계
                        </th>
                        <th className="w-[110px] bg-admin-surface-header border-b border-admin-border-subtle" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr
                          key={row.escape.id}
                          className={
                            row.escape.alertCount >= 3
                              ? "bg-admin-escape-alert-bg hover:bg-admin-escape-critical-bg"
                              : "hover:bg-admin-row-hover"
                          }
                        >
                          <td className="px-3 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                            {isoToKstMinuteString(row.escape.detectedAt)}
                          </td>
                          <td className="px-3 py-[13px] text-[13px] border-b border-border-faint">
                            {row.participantName}
                          </td>
                          <td className="px-3 py-[13px] text-[13px] border-b border-border-faint">
                            {row.escape.distanceKm.toFixed(2)}km
                          </td>
                          <td className="px-3 py-[13px] text-[13px] border-b border-border-faint font-semibold">
                            {row.escape.alertCount >= 3
                              ? "3단계"
                              : row.escape.alertCount === 2
                                ? "2단계"
                                : "1단계"}
                          </td>
                          <td className="px-3 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                            {row.escape.status === "OPEN" ? (
                              <button
                                className="border border-admin-border px-2.5 py-1 text-xs rounded-[2px] bg-white hover:bg-surface-page"
                                onClick={() =>
                                  handleResolveButtonClick(row.escape.id, row.participantName)
                                }
                              >
                                확인 처리
                              </button>
                            ) : (
                              <span className="text-xs text-text-subtle">
                                {row.escape.memo || "처리완료"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-8 text-center text-[13px] text-admin-text-placeholder"
                          >
                            {status === "OPEN"
                              ? "확인이 필요한 이탈이 없습니다."
                              : "처리된 이탈 이력이 없습니다."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {criticalEscape && (
        <div className="fixed inset-0 w-full h-full bg-black/60 z-[9999] flex justify-center items-center">
          <div className="bg-white p-[30px] rounded-xl max-w-[420px] w-[90%] shadow-lg">
            <div className="text-admin-escape-critical-text text-xl font-bold mb-4">
              🚨 3단계 위급 이탈
            </div>
            <div className="text-sm space-y-1.5 mb-5">
              <p>
                <strong>참여자:</strong> {criticalEscape.participantName}
              </p>
              <p>
                <strong>수요처:</strong> {criticalEscape.demandSiteName ?? "-"}
              </p>
              <p>
                <strong>이탈 횟수:</strong> {criticalEscape.escape.alertCount}회
              </p>
              <p>
                <strong>이탈 거리:</strong> {criticalEscape.escape.distanceKm.toFixed(2)}km
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                className="flex-1 py-3 text-sm font-bold rounded-[2px] bg-admin-brand text-white"
                onClick={handleResolveCriticalButtonClick}
              >
                확인 완료
              </button>
              <button
                className="flex-1 py-3 text-sm font-bold rounded-[2px] border border-admin-border bg-white"
                onClick={() => setCriticalEscape(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {lowerTierEscapeAlert && (
        <div className="fixed inset-0 w-full h-full bg-black/60 z-[9999] flex justify-center items-center">
          <div className="bg-white p-[30px] rounded-xl max-w-[420px] w-[90%] shadow-lg">
            <div
              className="text-xl font-bold mb-4"
              style={{ color: lowerTierEscapeAlert.tier >= 2 ? "#FF7800" : "#FFD200" }}
            >
              ⚠️ {lowerTierEscapeAlert.tier}단계 이탈
            </div>
            <div className="text-sm space-y-1.5 mb-5">
              <p>
                <strong>참여자:</strong> {lowerTierEscapeAlert.row.participantName}
              </p>
              <p>
                <strong>수요처:</strong> {lowerTierEscapeAlert.row.demandSiteName ?? "-"}
              </p>
              <p>
                <strong>이탈 횟수:</strong> {lowerTierEscapeAlert.row.escape.alertCount}회
              </p>
              <p>
                <strong>이탈 거리:</strong> {lowerTierEscapeAlert.row.escape.distanceKm.toFixed(2)}
                km
              </p>
            </div>
            <button
              className="w-full py-3 text-sm font-bold rounded-[2px] bg-admin-brand text-white"
              onClick={() => setLowerTierEscapeAlert(null)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {resolveTarget && (
        <PromptModal
          title={`'${resolveTarget.participantName}' 님 이탈 확인 처리 — 메모(선택)`}
          onConfirm={handleResolvePromptConfirm}
          onCancel={() => setResolveTarget(null)}
        />
      )}
    </div>
  );
};

export default EscapesPage;
