import { reportLocation } from "./attendanceApi";
import { isNativePlatform, startBackgroundLocationWatch } from "./backgroundLocation";
import { readCurrentCoordinates, type Coordinates } from "./geolocation";

// 서버 보고 주기. 서버의 통신 끊김 판정(checkSignalLoss.ts, 25분)은 이 값의 2배 이상이어야
// 전송이 한 번 실패해도 허위 알림이 가지 않는다 — 둘 중 하나를 바꾸면 같이 맞춰야 한다.
const REPORT_INTERVAL_MS = 10 * 60 * 1000;

export type LocationReportState = {
  // 관제구역을 벗어난 상태면 그 수요처명, 아니면 null
  escapedDemandSiteName: string | null;
  // 위치를 못 읽거나(권한 거부/측위 실패) 서버로 보내지 못한 상태.
  // 이 상태가 25분 넘게 이어지면 관리자 화면에 "통신 끊김"으로 잡힌다.
  reportFailing: boolean;
};

export const IDLE_LOCATION_REPORT_STATE: LocationReportState = {
  escapedDemandSiteName: null,
  reportFailing: false,
};

type StateListener = (state: LocationReportState) => void;

const sendReport = async (
  participantId: number,
  coordinates: Coordinates,
  onStateChange: StateListener,
): Promise<void> => {
  try {
    const result = await reportLocation(participantId, coordinates);
    onStateChange({
      escapedDemandSiteName: result.escaped ? (result.demandSiteName ?? null) : null,
      reportFailing: false,
    });
  } catch {
    // 네트워크 오류 등 — 참여자에게는 "위치가 전송되지 않는 중"으로 알려야 한다.
    // 모르는 채로 두면 나중에 통신 끊김으로 잡혔을 때 해명할 방법이 없다.
    onStateChange({ escapedDemandSiteName: null, reportFailing: true });
  }
};

// 웹(브라우저)용 — 앱이 화면에 보이는 동안만 동작한다. iOS는 백그라운드로 가면 JS 실행을
// 멈추고 안드로이드도 타이머를 억제하므로, 화면이 꺼진 사이의 공백은 서버 쪽 통신 끊김
// 감지로 드러난다. 그래서 화면이 다시 보이는 순간 즉시 한 번 보고해 공백을 줄인다.
const startForegroundReporting = (
  participantId: number,
  onStateChange: StateListener,
): (() => void) => {
  let stopped = false;
  // 측위가 최대 10초까지 걸려서, 앞선 보고가 끝나기 전에 다음 보고가 겹칠 수 있다
  let reporting = false;

  const reportOnce = async () => {
    if (stopped || reporting) return;
    reporting = true;
    try {
      const coordinates = await readCurrentCoordinates();
      if (stopped) return;
      if (!coordinates) {
        onStateChange({ escapedDemandSiteName: null, reportFailing: true });
        return;
      }
      await sendReport(participantId, coordinates, onStateChange);
    } finally {
      reporting = false;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") reportOnce();
  };

  reportOnce();
  const intervalId = window.setInterval(reportOnce, REPORT_INTERVAL_MS);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
};

// 하이브리드 앱용 — 화면이 꺼져 있어도 좌표가 들어온다.
//
// 감시 콜백은 참여자가 움직일 때만 오기 때문에(distanceFilter), 콜백만 보고 서버에
// 보내면 제자리에 앉아 근무하는 사람은 좌표를 하나도 못 보내 허위 통신 끊김이 된다.
// 그래서 마지막 좌표를 들고 있다가 콜백/타이머 어느 쪽이든 10분이 지났으면 보낸다.
// 반대로 많이 움직이는 사람에게 매 콜백마다 보내지 않도록 같은 기준으로 묶는다.
const startNativeReporting = (
  participantId: number,
  onStateChange: StateListener,
): (() => void) => {
  let stopped = false;
  let sending = false;
  let lastCoordinates: Coordinates | null = null;
  let lastSentAtMs = 0;

  const sendIfDue = async (force = false) => {
    if (stopped || sending || lastCoordinates === null) return;
    const elapsedMs = Date.now() - lastSentAtMs;
    if (!force && elapsedMs < REPORT_INTERVAL_MS) return;

    sending = true;
    // 전송 중에 새 좌표가 들어와도 이번에 보낸 좌표 기준으로 주기를 센다
    lastSentAtMs = Date.now();
    try {
      await sendReport(participantId, lastCoordinates, onStateChange);
    } finally {
      sending = false;
    }
  };

  const watch = startBackgroundLocationWatch({
    onPosition: (coordinates) => {
      lastCoordinates = coordinates;
      // 첫 좌표는 기다리지 않고 바로 보낸다 — 출근 직후 관제 공백을 만들지 않는다
      sendIfDue(lastSentAtMs === 0);
    },
    onUnavailable: () => {
      if (!stopped) {
        onStateChange({ escapedDemandSiteName: null, reportFailing: true });
      }
    },
  });

  const intervalId = window.setInterval(() => sendIfDue(), REPORT_INTERVAL_MS);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    watch.stop();
  };
};

/**
 * 근무 중 위치 보고를 시작하고, 중단하는 함수를 돌려줍니다.
 *
 * 하이브리드 앱에서는 화면이 꺼져도 계속 보고하고(포그라운드 서비스/백그라운드 모드),
 * 웹에서는 앱이 화면에 보이는 동안만 보고합니다.
 *
 * 반드시 출근~퇴근 사이에만 호출하고 퇴근하면 반환된 함수로 멈춰야 합니다 —
 * 근무시간 외 위치를 수집하면 수집 목적을 벗어납니다.
 */
export const startLocationReporting = (
  participantId: number,
  onStateChange: StateListener,
): (() => void) =>
  isNativePlatform()
    ? startNativeReporting(participantId, onStateChange)
    : startForegroundReporting(participantId, onStateChange);
