import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import { Capacitor, registerPlugin } from "@capacitor/core";

export type Coordinates = {
  lat: number;
  lng: number;
  // 브라우저가 알려주는 GPS 오차 반경(m). 실내나 네트워크 기반 측위에선 수백~수천 m까지
  // 나오므로, 서버에 남긴 거리값을 해석할 때 반드시 같이 봐야 한다.
  accuracy: number | null;
  // 좌표가 실제 GPS가 아니라 위치 조작 앱이 주입한 값인지. 브라우저 위치 API는 이 정보를
  // 주지 않아서 웹에서는 항상 null이고, 하이브리드 앱의 백그라운드 위치 감시에서만 채워진다.
  simulated: boolean | null;
};

// 고정밀 측위는 실내에서 오래 걸리거나 아예 못 잡는다. 출근 버튼을 누른 참여자를
// 무한정 기다리게 할 수 없으니 여기서 끊는다(10초는 체감상 "출근 버튼이 멈춘 것처럼"
// 느껴질 만큼 길다).
const TIMEOUT_MS = 5000;

/**
 * 출퇴근 등록 직전에 현재 위치를 한 번 읽습니다.
 *
 * 권한 거부·측위 실패·타임아웃·미지원 등 어떤 이유로든 못 읽으면 null을 돌려줍니다.
 * 서버는 좌표가 없으면 LOCATION_REQUIRED로 출퇴근 자체를 막으므로(근무지 확인·안전
 * 관리의 전제), 호출부는 null이 왔을 때 그 실패를 사용자에게 안내해야 합니다.
 */
export const readCurrentCoordinates = (): Promise<Coordinates | null> => {
  if (!navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          simulated: null,
        }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: TIMEOUT_MS,
        // 캐시된 예전 좌표(예: 집에서 잡힌 위치)를 그대로 쓰면 기록이 의미가 없다 —
        // 항상 새로 측위한다.
        maximumAge: 0,
      },
    );
  });
};

export type GeolocationFailureReason = "permission-denied" | "location-services-off" | "other";

// 💡 실기기에서 확인해보니, 기기 위치 서비스가 꺼져있어도 브라우저 Geolocation API가
// POSITION_UNAVAILABLE을 바로 안 주고 그냥 타임아웃까지 가는 경우가 있었다(안드로이드
// 기종/버전마다 WebView 동작이 다름) — 그러면 "기타(일시적 실패)"로 잘못 분류돼서
// "위치 서비스를 켜주세요" 안내 대신 애매한 재시도 메시지가 떴다. BackgroundGeolocation
// 네이티브 플러그인은 addWatcher 호출 즉시(측위를 기다리지 않고) LocationManager로
// 위치 서비스 켜짐 여부를 동기 확인해서 바로 실패를 알려주므로 훨씬 신뢰할 수 있다 —
// 이미 근무 중 위치 감시(backgroundLocation.ts)에 쓰고 있는 플러그인을 재사용한다.
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

/**
 * LOCATION_REQUIRED로 출퇴근이 막혔을 때만 호출해서 실패 이유를 구분합니다.
 *
 * 셋 다 다시 시도해도 똑같이 실패하거나(앱 권한 거부, 기기 위치 서비스 꺼짐) 재시도가
 * 의미 있을 수 있는(실내 등 일시적 실패) 경우로 나뉘어서, 앞의 두 경우는 무의미한
 * 재시도 루프 대신 정확히 뭘 해야 하는지(OS 설정 어디를 열어야 하는지)를 구분해서
 * 안내해야 합니다.
 */
export const checkGeolocationFailureReason = (): Promise<GeolocationFailureReason> => {
  if (!Capacitor.isNativePlatform()) {
    // 웹 미리보기에는 BackgroundGeolocation 네이티브 구현이 없다 — 브라우저
    // Geolocation API의 에러 코드로 대신 구분한다(정확도는 네이티브보다 떨어짐).
    if (!navigator.geolocation) return Promise.resolve("other");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve("other"),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) resolve("permission-denied");
          else if (error.code === error.POSITION_UNAVAILABLE) resolve("location-services-off");
          else resolve("other");
        },
        { timeout: 3000, maximumAge: 60_000 },
      );
    });
  }

  // 💡 BackgroundGeolocation의 addWatcher는 최초 실패(권한 없음/위치 서비스 꺼짐)를
  // 콜백이 아니라 addWatcher() 자체가 반환하는 프로미스의 reject로 알려준다 — 이후
  // 위치가 갱신될 때만 콜백이 불린다. 그래서 이유 판별은 프로미스 reject 쪽에서도
  // 반드시 콜백과 똑같이 message를 확인해야 한다(전에는 .catch에서 이유를 안 보고
  // 무조건 "other"로 떨어뜨려서, 위치 서비스가 꺼져있어도 "위치를 확인하지 못했어요"
  // 라는 애매한 메시지만 뜨는 버그가 있었다).
  const reasonFromError = (error: unknown): GeolocationFailureReason => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("disabled")) return "location-services-off";
    if (message.includes("denied")) return "permission-denied";
    return "other";
  };

  return new Promise((resolve) => {
    let settled = false;
    let watcherId: string | null = null;
    const settle = (reason: GeolocationFailureReason) => {
      if (settled) return;
      settled = true;
      resolve(reason);
      if (watcherId !== null) BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
    };

    BackgroundGeolocation.addWatcher(
      // 권한 팝업을 다시 띄우지 않고(이미 permission-denied 여부는 별도로 확인함),
      // 새 GPS 측위를 기다리지 않는(stale: true) 순수 진단용 호출이다.
      { requestPermissions: false, stale: true },
      (_position, error) => {
        settle(error ? reasonFromError(error) : "other");
      },
    )
      .then((id) => {
        if (settled) {
          BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
        } else {
          watcherId = id;
        }
      })
      .catch((error) => settle(reasonFromError(error)));

    // 콜백이 끝내 안 오는 경우(플러그인 미탑재 등)를 대비한 안전장치.
    setTimeout(() => settle("other"), 3000);
  });
};
