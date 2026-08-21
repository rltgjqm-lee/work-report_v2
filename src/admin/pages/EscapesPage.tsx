import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

import { isoToKstMinuteString, isoToKstTimeString } from "../../utils/timeFormat";
import { useToast } from "../context/useToast";

import {
  demandSiteLocationsByProgramQueryOptions,
  demandSitesQueryOptions,
} from "../api/admin/demandSites";
import {
  escapesQueryOptions,
  liveMapQueryOptions,
  markEscapeAlertedMutationOptions,
  resolveEscapeMutationOptions,
} from "../api/admin/escapes";
import { programsQueryOptions } from "../api/admin/programs";
import { markSosNotifiedMutationOptions, resolveSosMutationOptions } from "../api/admin/sos";
import FilterSelect from "../components/FilterSelect";
import PromptModal from "../components/modal/PromptModal";
import SearchInput from "../components/SearchInput";
import { PROGRAM_TYPE_FILTER_OPTIONS } from "../constants/programTypes";
import type { DemandSiteLocation } from "../types/demandSites";
import type { EscapeRow, EscapeStatus, LiveWorker } from "../types/escapes";
import type { SosRow } from "../types/sos";

// 수요처별 관제구역 — 지도에 그릴 때 어느 수요처 것인지 알아야 필터가 걸린다.
// location이 null이면 거점이 아니라 수요처 자체에 잡아둔 기본 원이다.
interface DemandSiteGeofence {
  demandSiteId: number;
  demandSiteName: string;
  location: DemandSiteLocation | null;
  baseArea: { lat: number; lng: number; radius: number } | null;
}

// 참여자 위치 보고 자체가 최대 10분 주기(locationReporting.ts)라 그보다 훨씬 짧게 잡아도
// 실제로 더 새 데이터를 받지는 못한다. 이제 이탈 발생 시 참여자에게 단계 무관 즉시 푸시가
// 나가므로(worker/src/routes/user/public.ts) 이 폴링은 "화면을 보고 있을 때 알아채는"
// 보조 채널 — 서버 부하를 줄이면서도 화면이 오래 안 바뀌었다는 느낌은 안 들 선에서 1분.
const POLL_INTERVAL_MS = 60 * 1000;

const ESCAPE_STATUS_OPTIONS = [
  { value: "OPEN", label: "확인 필요" },
  { value: "RESOLVED", label: "처리 완료" },
];

// 이탈/SOS 팝업을 한 번에 하나씩 순서대로 보여주기 위한 큐 항목. 폴링 한 번에 여러
// 건이 동시에 새로 잡혀도 먼저 잡힌 팝업이 사용자가 보기 전에 다음 걸로 덮어써지지
// 않도록, state 하나를 계속 갈아끼우는 대신 큐에 쌓아 앞에서부터 하나씩 뺀다.
type AlertQueueItem =
  | { kind: "escape-critical"; row: EscapeRow }
  | { kind: "escape-lower"; row: EscapeRow; tier: 1 | 2 }
  | { kind: "sos"; row: SosRow };

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const programIdParam = searchParams.get("programId");
  const preselectedProgramId = programIdParam ? Number(programIdParam) : null;

  const [programTypeFilter, setProgramTypeFilter] = useState("all");
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programIdParam ?? "");
  const [status, setStatus] = useState<EscapeStatus>("OPEN");
  const [search, setSearch] = useState("");
  const [alertQueue, setAlertQueue] = useState<AlertQueueItem[]>([]);
  const queuedAlertKeysRef = useRef<Set<string>>(new Set());
  const currentAlert = alertQueue[0] ?? null;
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
  const filteredPrograms = useMemo(
    () =>
      programTypeFilter === "all"
        ? programs
        : programs.filter((program) => program.programType === programTypeFilter),
    [programs, programTypeFilter],
  );

  // 실시간 근무자 위치 + 확인 필요(OPEN) 이탈 — 위급 이탈 감지를 위해 항상 폴링한다.
  // RESOLVED는 상태 탭을 볼 때만 따로 조회한다(폴링 안 함).
  const { data: liveMap } = useQuery({
    ...liveMapQueryOptions(programId),
    enabled: !!programId,
    refetchInterval: POLL_INTERVAL_MS,
  });
  const openEscapes = liveMap?.openEscapes ?? [];
  const openSosEvents = liveMap?.openSosEvents ?? [];
  const workers = useMemo(() => liveMap?.workers ?? [], [liveMap]);

  const { data: resolvedEscapes = [] } = useQuery({
    ...escapesQueryOptions(programId, "RESOLVED"),
    enabled: !!programId && status === "RESOLVED",
  });
  const rows = status === "OPEN" ? openEscapes : resolvedEscapes;

  const { data: demandSitesData } = useQuery({
    ...demandSitesQueryOptions(programId),
    enabled: !!programId,
  });
  const demandSites = useMemo(() => demandSitesData?.demandSites ?? [], [demandSitesData]);
  const programName = demandSitesData?.programName ?? "";
  const { data: demandSiteLocations = [] } = useQuery({
    ...demandSiteLocationsByProgramQueryOptions(programId),
    enabled: !!programId,
  });
  const geofences = useMemo(
    () =>
      demandSites.flatMap((demandSite) => {
        const locations = demandSiteLocations.filter(
          (location) => location.demandSiteId === demandSite.id,
        );
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
    [demandSites, demandSiteLocations],
  );

  const resolveEscapeMutation = useMutation(resolveEscapeMutationOptions(queryClient));
  const markEscapeAlertedMutation = useMutation(markEscapeAlertedMutationOptions(queryClient));
  const resolveSosMutation = useMutation(resolveSosMutationOptions(queryClient));
  const markSosNotifiedMutation = useMutation(markSosNotifiedMutationOptions(queryClient));

  // 새로 악화된 이탈(1/2/3단계)과 새 SOS를 감지해 팝업 큐에 쌓는다 — openEscapes/
  // openSosEvents가 폴링될 때마다 확인한다. escape는 alertedAtCount, sos는 notifiedAt이
  // 서버에 남아있어 새로고침해도 같은 걸로 다시 안 쌓이고, 더 악화되거나(escape) 새로
  // 발생해야(sos) 다시 쌓인다. 큐 dedupe 키에 escape는 alertCount를 포함해서, 팝업을
  // 아직 못 봤어도 더 악화되면 새 항목으로 다시 쌓이게 한다.
  useEffect(() => {
    const newItems: AlertQueueItem[] = [];

    openEscapes.forEach((row) => {
      if (row.escape.alertCount <= row.escape.alertedAtCount) return;
      const key = `escape-${row.escape.id}-${row.escape.alertCount}`;
      if (queuedAlertKeysRef.current.has(key)) return;
      queuedAlertKeysRef.current.add(key);

      newItems.push(
        row.escape.alertCount >= 3
          ? { kind: "escape-critical", row }
          : { kind: "escape-lower", row, tier: row.escape.alertCount >= 2 ? 2 : 1 },
      );
      markEscapeAlertedMutation.mutate({ escapeId: row.escape.id, programId });
    });

    openSosEvents.forEach((row) => {
      if (row.sos.notifiedAt) return;
      const key = `sos-${row.sos.id}`;
      if (queuedAlertKeysRef.current.has(key)) return;
      queuedAlertKeysRef.current.add(key);

      newItems.push({ kind: "sos", row });
      markSosNotifiedMutation.mutate({ sosId: row.sos.id, programId });
    });

    if (newItems.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 폴링된 서버 상태를 감지해 큐에 쌓는다
    setAlertQueue((queue) => [...queue, ...newItems]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEscapes, openSosEvents]);

  const dismissCurrentAlert = () => setAlertQueue((queue) => queue.slice(1));

  const filteredWorkers = useMemo(
    () =>
      workers.filter(
        (worker) =>
          worker.name.includes(search) &&
          (!selectedDemandSiteId || String(worker.demandSiteId) === selectedDemandSiteId),
      ),
    [workers, search, selectedDemandSiteId],
  );

  const filteredRows = useMemo(() => {
    if (!selectedDemandSiteId) return rows;

    return rows.filter((row) => row.escape.demandSiteId === Number(selectedDemandSiteId));
  }, [rows, selectedDemandSiteId]);

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
    if (currentAlert?.kind !== "escape-critical") return;
    const { row } = currentAlert;

    resolveEscapeMutation.mutate(
      { escapeId: row.escape.id, programId },
      {
        onSuccess: () => {
          showToast(`'${row.participantName}' 님의 이탈을 확인 처리했습니다.`);
          dismissCurrentAlert();
        },
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleResolveSosButtonClick = () => {
    if (currentAlert?.kind !== "sos") return;
    const { row } = currentAlert;

    resolveSosMutation.mutate(
      { sosId: row.sos.id, programId },
      {
        onSuccess: () => {
          showToast(`'${row.participantName}' 님의 SOS를 확인 처리했습니다.`);
          dismissCurrentAlert();
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

  const programOptions = [
    { value: "", label: "사업단을 선택하세요" },
    ...filteredPrograms.map((program) => ({
      value: String(program.id),
      label: program.name,
    })),
  ];

  const demandSiteOptions = [
    { value: "", label: "전체 수요처" },
    ...demandSites.map((demandSite) => ({
      value: String(demandSite.id),
      label: demandSite.name,
    })),
  ];

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          {preselectedProgramId ? (
            <div className="text-xs text-text-subtle mb-1.5">
              사업단 관리 /{" "}
              <a
                onClick={() => navigate(`/admin/program?id=${preselectedProgramId}`)}
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
              options={PROGRAM_TYPE_FILTER_OPTIONS}
            />
          )}
          {!preselectedProgramId && (
            <FilterSelect
              value={selectedProgramId}
              onChange={handleProgramFilterChange}
              options={programOptions}
            />
          )}
          <FilterSelect
            value={selectedDemandSiteId}
            onChange={setSelectedDemandSiteId}
            disabled={!programId}
            options={demandSiteOptions}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 참여자 이름 검색" />
          <FilterSelect
            value={status}
            onChange={(value) => setStatus(value as EscapeStatus)}
            options={ESCAPE_STATUS_OPTIONS}
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

      {alertQueue.length > 1 && (
        <div className="fixed top-4 right-4 z-[10000] bg-admin-escape-critical-text text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
          확인 대기 중 {alertQueue.length}건
        </div>
      )}

      {currentAlert?.kind === "escape-critical" && (
        <div className="fixed inset-0 w-full h-full bg-black/60 z-[9999] flex justify-center items-center">
          <div className="bg-white p-[30px] rounded-xl max-w-[420px] w-[90%] shadow-lg">
            <div className="text-admin-escape-critical-text text-xl font-bold mb-4">
              🚨 3단계 위급 이탈
            </div>
            <div className="text-sm space-y-1.5 mb-5">
              <p>
                <strong>참여자:</strong> {currentAlert.row.participantName}
              </p>
              <p>
                <strong>수요처:</strong> {currentAlert.row.demandSiteName ?? "-"}
              </p>
              <p>
                <strong>이탈 횟수:</strong> {currentAlert.row.escape.alertCount}회
              </p>
              <p>
                <strong>이탈 거리:</strong> {currentAlert.row.escape.distanceKm.toFixed(2)}km
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
                onClick={dismissCurrentAlert}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {currentAlert?.kind === "escape-lower" && (
        <div className="fixed inset-0 w-full h-full bg-black/60 z-[9999] flex justify-center items-center">
          <div className="bg-white p-[30px] rounded-xl max-w-[420px] w-[90%] shadow-lg">
            <div
              className="text-xl font-bold mb-4"
              style={{ color: currentAlert.tier >= 2 ? "#FF7800" : "#FFD200" }}
            >
              ⚠️ {currentAlert.tier}단계 이탈
            </div>
            <div className="text-sm space-y-1.5 mb-5">
              <p>
                <strong>참여자:</strong> {currentAlert.row.participantName}
              </p>
              <p>
                <strong>수요처:</strong> {currentAlert.row.demandSiteName ?? "-"}
              </p>
              <p>
                <strong>이탈 횟수:</strong> {currentAlert.row.escape.alertCount}회
              </p>
              <p>
                <strong>이탈 거리:</strong> {currentAlert.row.escape.distanceKm.toFixed(2)}km
              </p>
            </div>
            <button
              className="w-full py-3 text-sm font-bold rounded-[2px] bg-admin-brand text-white"
              onClick={dismissCurrentAlert}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {currentAlert?.kind === "sos" && (
        <div className="fixed inset-0 w-full h-full bg-black/60 z-[9999] flex justify-center items-center">
          <div className="bg-white p-[30px] rounded-xl max-w-[420px] w-[90%] shadow-lg">
            <div className="text-admin-escape-critical-text text-xl font-bold mb-4">
              🚨 SOS 발생
            </div>
            <div className="text-sm space-y-1.5 mb-5">
              <p>
                <strong>참여자:</strong> {currentAlert.row.participantName}
              </p>
              <p>
                <strong>수요처:</strong> {currentAlert.row.demandSiteName ?? "-"}
              </p>
              <p>
                <strong>발생 시각:</strong> {isoToKstMinuteString(currentAlert.row.sos.triggeredAt)}
              </p>
              <p>
                <strong>이탈 여부:</strong>{" "}
                {currentAlert.row.sos.escapeStatusAtTrigger === "OUTSIDE"
                  ? "이탈 중"
                  : currentAlert.row.sos.escapeStatusAtTrigger === "INSIDE"
                    ? "구역 내"
                    : "확인 불가"}
              </p>
            </div>
            <button
              className="w-full py-3 text-sm font-bold rounded-[2px] bg-admin-brand text-white"
              onClick={handleResolveSosButtonClick}
            >
              확인 완료
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
