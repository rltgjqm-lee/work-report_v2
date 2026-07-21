import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  getEscapes,
  getLiveWorkers,
  getProgram,
  listPrograms,
} from "../api/admin/programs";
import { markEscapeAlerted, resolveEscape } from "../api/admin/escapes";
import SearchInput from "../components/SearchInput";
import FilterSelect from "../components/FilterSelect";
import type { EscapeRow, EscapeStatus, LiveWorker, Program } from "../types";

const POLL_INTERVAL_MS = 10000;

// 3단계 신호등 — alertCount 기준 (설계의 outside_minutes는 이번 구현에서 안 씀)
const getMarkerColor = (worker: LiveWorker): string => {
  if (worker.alertCount >= 3) return "#FF0000";
  if (worker.alertCount >= 2) return "#FF7800";
  if (worker.alertCount >= 1) return "#FFD200";
  return "#2ECC71";
};

/**
 * 관리자 페이지 > 이탈 관제 페이지입니다.
 *
 */
const EscapesPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const preselectedProgramId = id ? Number(id) : null;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(id ?? "");
  const [programName, setProgramName] = useState("");
  const [status, setStatus] = useState<EscapeStatus>("OPEN");
  const [rows, setRows] = useState<EscapeRow[]>([]);
  const [workers, setWorkers] = useState<LiveWorker[]>([]);
  const [search, setSearch] = useState("");
  const [criticalEscape, setCriticalEscape] = useState<EscapeRow | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // 사이드바로 바로 들어온 경우(사업단 id 없음) 고를 수 있게 전체 사업단 목록을 가져온다
  useEffect(() => {
    if (!preselectedProgramId) listPrograms().then(setPrograms);
  }, [preselectedProgramId]);

  useEffect(() => {
    if (preselectedProgramId) {
      getProgram(preselectedProgramId).then((program) =>
        setProgramName(program.name),
      );
    }
  }, [preselectedProgramId]);

  const programId = preselectedProgramId ?? Number(selectedProgramId);

  const refresh = () => {
    if (!programId) return;
    getEscapes(programId, status).then(setRows);
  };

  useEffect(refresh, [programId, status]);

  // 관제 폴링 — 실시간 근무자 위치 갱신 + 새로 발생한 3단계(위급) 이탈을 감지해 팝업.
  // programId가 없으면(사이드바 진입 직후, 아직 미선택) 아래 렌더링에서 안내 문구만 보여주므로
  // rows/workers를 굳이 초기화할 필요가 없다.
  useEffect(() => {
    if (!programId) return;

    const tick = async () => {
      getLiveWorkers(programId).then(setWorkers);

      const openEscapes = await getEscapes(programId, "OPEN");
      if (status === "OPEN") setRows(openEscapes);

      const critical = openEscapes.find(
        (row) => row.escape.alertCount >= 3 && !row.escape.alerted,
      );
      if (critical) {
        setCriticalEscape(critical);
        markEscapeAlerted(critical.escape.id);
      }
    };

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [programId, status]);

  const filteredWorkers = useMemo(
    () => workers.filter((worker) => worker.name.includes(search)),
    [workers, search],
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
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [programId]);

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
          `마지막 위치: ${
            worker.lastLocationAt
              ? new Date(worker.lastLocationAt).toLocaleTimeString()
              : "-"
          }`,
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

  const handleResolve = async (escapeId: number, participantName: string) => {
    const memo = prompt(`'${participantName}' 님 이탈 확인 처리 — 메모(선택)`);
    if (memo === null) return;

    try {
      await resolveEscape(escapeId, memo || undefined);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleResolveCritical = async () => {
    if (!criticalEscape) return;
    try {
      await resolveEscape(criticalEscape.escape.id);
      setCriticalEscape(null);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          {preselectedProgramId ? (
            <div className="text-xs text-[#6b7280] mb-1.5">
              사업단 관리 /{" "}
              <a
                onClick={() =>
                  navigate(`/admin/programs/${preselectedProgramId}`)
                }
                className="cursor-pointer text-[#1e3a5f] hover:text-[#132a45]"
              >
                {programName || "사업단 상세"}
              </a>{" "}
              / 이탈 관제
            </div>
          ) : null}
          <h1 className="text-[21px] font-bold m-0">이탈 관제</h1>
        </div>
        <div className="flex items-center gap-2.5">
          {!preselectedProgramId && (
            <FilterSelect
              value={selectedProgramId}
              onChange={setSelectedProgramId}
              options={[
                { value: "", label: "사업단을 선택하세요" },
                ...programs.map((program) => ({
                  value: String(program.id),
                  label: program.name,
                })),
              ]}
            />
          )}
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="🔍 어르신 이름 검색"
          />
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
        <div className="bg-white border border-[#e2e5eb] rounded-[2px] px-5 py-10 text-center text-[13px] text-[#9aa1ab]">
          조회할 사업단을 선택해주세요.
        </div>
      ) : (
        <>
          <div
            ref={mapContainerRef}
            className="h-[420px] w-full mb-5 border border-[#e2e5eb] rounded-[2px]"
          />

          <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed border-collapse">
                <thead>
                  <tr>
                    <th className="w-[150px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      감지시각
                    </th>
                    <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      참여자명
                    </th>
                    <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      조
                    </th>
                    <th className="w-[140px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      수요처
                    </th>
                    <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      이탈거리
                    </th>
                    <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      단계
                    </th>
                    <th className="w-[140px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.escape.id}
                      className={
                        row.escape.alertCount >= 3
                          ? "bg-[#fdecea] hover:bg-[#fbdedb]"
                          : "hover:bg-[#f8fafc]"
                      }
                    >
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                        {row.escape.detectedAt}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                        {row.participantName}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                        {row.groupName ?? "-"}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                        {row.demandSiteName ?? "-"}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                        {row.escape.distanceKm.toFixed(2)}km
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] font-semibold">
                        {row.escape.alertCount >= 3
                          ? "3단계(위급)"
                          : row.escape.alertCount === 2
                            ? "2단계(주의)"
                            : "1단계(경고)"}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                        {row.escape.status === "OPEN" ? (
                          <button
                            className="border border-[#d7dbe1] px-2.5 py-1 text-xs rounded-[2px] bg-white hover:bg-[#f3f4f6]"
                            onClick={() =>
                              handleResolve(row.escape.id, row.participantName)
                            }
                          >
                            확인 처리
                          </button>
                        ) : (
                          <span className="text-xs text-[#6b7280]">
                            {row.escape.memo || "처리완료"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]"
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
        </>
      )}

      {criticalEscape && (
        <div className="fixed inset-0 w-full h-full bg-black/60 z-[9999] flex justify-center items-center">
          <div className="bg-white p-[30px] rounded-xl max-w-[420px] w-[90%] shadow-lg">
            <div className="text-[#e74c3c] text-xl font-bold mb-4">
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
                <strong>이탈 거리:</strong>{" "}
                {criticalEscape.escape.distanceKm.toFixed(2)}km
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                className="flex-1 py-3 text-sm font-bold rounded-[2px] bg-[#1e3a5f] text-white"
                onClick={handleResolveCritical}
              >
                확인 완료
              </button>
              <button
                className="flex-1 py-3 text-sm font-bold rounded-[2px] border border-[#d7dbe1] bg-white"
                onClick={() => setCriticalEscape(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EscapesPage;
