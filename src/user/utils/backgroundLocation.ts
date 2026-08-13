import type {
  BackgroundGeolocationPlugin,
  Location,
} from "@capacitor-community/background-geolocation";
import { Capacitor, registerPlugin } from "@capacitor/core";

import type { Coordinates } from "./geolocation";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

// 이 거리(m) 이상 움직였을 때만 새 좌표를 받는다. 서버 보고는 별도로 10분에 한 번으로
// 묶으므로 이 값은 통신량이 아니라 GPS 사용량(배터리)을 좌우한다.
const DISTANCE_FILTER_M = 25;

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export type BackgroundLocationWatch = {
  stop: () => void;
};

/**
 * 근무 중 백그라운드 위치 감시를 시작합니다. 하이브리드 앱(iOS/Android)에서만 동작합니다.
 *
 * 안드로이드는 상단에 알림이 상주하는 포그라운드 서비스로 돌아가고(그래서 백그라운드
 * 위치 권한이 필요 없다), iOS는 UIBackgroundModes location으로 화면이 꺼져도 좌표가
 * 들어옵니다. 둘 다 참여자에게 "위치가 확인되는 중"이 드러나는 방식입니다.
 *
 * 반드시 출근~퇴근 사이에만 켜고 퇴근하면 stop()으로 꺼야 합니다 — 근무시간 외 위치를
 * 수집하면 수집 목적을 벗어납니다.
 */
export const startBackgroundLocationWatch = ({
  onPosition,
  onUnavailable,
}: {
  onPosition: (coordinates: Coordinates) => void;
  // 권한 거부·위치 서비스 꺼짐 등으로 좌표를 받을 수 없는 상태
  onUnavailable: () => void;
}): BackgroundLocationWatch => {
  let stopped = false;
  let watcherId: string | null = null;

  const handleUpdate = (position?: Location, error?: Error) => {
    if (stopped) return;
    if (error || !position) {
      onUnavailable();
      return;
    }
    onPosition({
      lat: position.latitude,
      lng: position.longitude,
      accuracy: Number.isFinite(position.accuracy) ? position.accuracy : null,
      // OS가 알려주는 위치 조작 여부 — 이 값이 있는 건 네이티브 감시뿐이다
      simulated: position.simulated,
    });
  };

  BackgroundGeolocation.addWatcher(
    {
      // backgroundMessage가 있어야 백그라운드에서도 좌표가 들어온다 —
      // 안드로이드에선 이 문구가 상주 알림 본문으로 그대로 보인다.
      backgroundMessage: "퇴근을 등록하면 종료됩니다.",
      backgroundTitle: "안전을 위해 위치를 확인하고 있어요",
      requestPermissions: true,
      // 오래된 좌표로 이탈을 판정하면 안 되므로 GPS 확정 좌표만 받는다
      stale: false,
      distanceFilter: DISTANCE_FILTER_M,
    },
    handleUpdate,
  )
    .then((id) => {
      // 등록이 끝나기 전에 퇴근했으면 곧바로 정리한다
      if (stopped) {
        BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
        return;
      }
      watcherId = id;
    })
    .catch(() => {
      if (!stopped) onUnavailable();
    });

  return {
    stop: () => {
      stopped = true;
      if (watcherId === null) return;
      BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
      watcherId = null;
    },
  };
};
