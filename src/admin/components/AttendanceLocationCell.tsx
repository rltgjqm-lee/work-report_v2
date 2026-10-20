import type { AttendanceLog } from "../types/attendance";

const formatDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;

/**
 * 근무 한 건의 위치 신뢰도 요약 — 근무 목록과 참여자 상세에서 같이 씁니다.
 *
 * 원형 관제 반경이 최소 1.5km라서 "구역 내"인지만 보면 자택 출근을 걸러낼 수 없습니다 —
 * 구역 안이면 원형 구역 중심까지의 거리를, 구역 밖이면 경계 밖으로 나간 거리를 보여줍니다.
 * 다각형 안에만 있으면 거리가 없습니다(길쭉한 다각형의 "중심"은 의미가 없어서).
 * GPS 오차가 크면 그 거리 자체를 믿을 수 없으니 오차 반경도 같이 보여줍니다.
 *
 * 위치 조작 표시는 출근 시점만이 아니라 그 날 전체(근무 중 보고 포함) 기준이라
 * 마지막 줄에 따로 보여줍니다.
 */
const AttendanceLocationCell = ({ log }: { log: AttendanceLog }) => {
  // 조작 표시는 출근 좌표를 못 받은 날에도 보여야 한다 — 위치 판정과 별개의 정보다.
  const simulatedWarning = log.simulatedCount > 0 && (
    <div className="text-[11.5px] font-bold text-danger-strong">
      ⚠️ 위치 조작 의심 {log.simulatedCount}건
    </div>
  );

  if (log.clockInLat === null || log.clockInLng === null) {
    return (
      <div>
        <span className="text-admin-text-placeholder">미기록</span>
        {simulatedWarning}
      </div>
    );
  }

  const distanceLabel =
    log.clockInDistanceM === null
      ? null
      : `${log.clockInInside === false ? "경계 밖" : "중심"} ${formatDistance(log.clockInDistanceM)}`;

  return (
    <div>
      <div className={log.clockInInside === false ? "text-danger-strong" : ""}>
        {log.clockInInside === null ? "판정 불가" : log.clockInInside ? "구역 내" : "구역 외"}
        {distanceLabel && ` · ${distanceLabel}`}
      </div>
      {log.clockInAccuracy !== null && (
        <div className="text-[11.5px] text-admin-text-placeholder">
          오차 ±{formatDistance(Math.round(log.clockInAccuracy))}
        </div>
      )}
      {simulatedWarning}
    </div>
  );
};

export default AttendanceLocationCell;
