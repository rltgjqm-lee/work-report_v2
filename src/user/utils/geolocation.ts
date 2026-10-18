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

// 좌표를 못 읽었을 때 기기 쪽 실패 이유 — 출퇴근 실패 기록(attendance_attempt_failures)에
// 그대로 남겨서 "GPS 오류로 안 찍힌다" 문의가 왔을 때 원인을 구분하는 데 쓴다.
export type LocationReadFailure =
  | "PERMISSION_DENIED"
  | "LOCATION_SERVICES_OFF"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "UNSUPPORTED";

export type LocationReading = {
  coordinates: Coordinates | null;
  // coordinates가 있으면 null
  failure: LocationReadFailure | null;
  // 측위에 걸린 시간 — 타임아웃(TIMEOUT_MS)이 현장에서 충분한지 판단하는 근거
  elapsedMs: number;
};

const failureFromErrorCode = (error: GeolocationPositionError): LocationReadFailure => {
  if (error.code === error.PERMISSION_DENIED) return "PERMISSION_DENIED";
  if (error.code === error.POSITION_UNAVAILABLE) return "POSITION_UNAVAILABLE";
  return "TIMEOUT";
};

// 웹(브라우저)용 — 브라우저 Geolocation API로 한 번 측위한다.
const readCurrentLocationFromBrowser = (): Promise<LocationReading> => {
  if (!navigator.geolocation) {
    return Promise.resolve({ coordinates: null, failure: "UNSUPPORTED", elapsedMs: 0 });
  }

  const startedAtMs = Date.now();
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
            simulated: null,
          },
          failure: null,
          elapsedMs: Date.now() - startedAtMs,
        }),
      (error) =>
        resolve({
          coordinates: null,
          failure: failureFromErrorCode(error),
          elapsedMs: Date.now() - startedAtMs,
        }),
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

// 처음 한 번은 OS 위치 권한 팝업이 뜨는데, 참여자가 팝업을 읽고 누르는 시간까지
// TIMEOUT_MS에 넣으면 허락하자마자 타임아웃이 된다 — 이 기기에서 네이티브 측위에 한 번도
// 성공한 적이 없을 때만 이만큼 더 기다린다(브라우저 API는 권한 대기 시간을 timeout에
// 안 넣어서 웹엔 필요 없다). 플러그인엔 권한 상태만 조회하는 API가 없어서 성공 이력으로
// 대신 판단한다.
const PERMISSION_PROMPT_GRACE_MS = 30_000;
const NATIVE_LOCATION_SUCCEEDED_KEY = "nativeLocationSucceeded";

const hasNativeLocationSucceeded = (): boolean => {
  try {
    return localStorage.getItem(NATIVE_LOCATION_SUCCEEDED_KEY) === "true";
  } catch {
    return false;
  }
};

const markNativeLocationSucceeded = () => {
  try {
    localStorage.setItem(NATIVE_LOCATION_SUCCEEDED_KEY, "true");
  } catch {
    // 저장이 안 되면 다음에도 권한 대기 시간을 더 줄 뿐이라 무시한다
  }
};

const failureFromNativeError = (error: unknown): LocationReadFailure => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("disabled")) return "LOCATION_SERVICES_OFF";
  if (message.includes("denied")) return "PERMISSION_DENIED";
  return "POSITION_UNAVAILABLE";
};

// 하이브리드 앱용 — WebView의 브라우저 API 대신 네이티브 GPS로 측위한다. WebView 측위는
// 기종/버전마다 동작이 달라 실내에서 첫 좌표를 늦게 잡거나 타임아웃까지 가는 경우가
// 있었고, 위치 조작 여부(simulated)도 네이티브에서만 알 수 있다.
//
// 새 GPS 좌표 하나를 받으면 바로 감시를 끈다. 근무 중 백그라운드 감시(backgroundLocation.ts)가
// 돌고 있어도 플러그인이 감시를 여러 개 따로 관리하므로 서로 영향이 없다.
// backgroundMessage를 안 넣어서 상주 알림도 뜨지 않는다.
const readCurrentLocationFromNative = (): Promise<LocationReading> => {
  const startedAtMs = Date.now();
  const timeoutMs = hasNativeLocationSucceeded()
    ? TIMEOUT_MS
    : TIMEOUT_MS + PERMISSION_PROMPT_GRACE_MS;

  return new Promise((resolve) => {
    let settled = false;
    let watcherId: string | null = null;
    const settle = (reading: LocationReading) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(reading);
      if (watcherId !== null) {
        BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
      }
    };
    const settleWithFailure = (failure: LocationReadFailure) =>
      settle({ coordinates: null, failure, elapsedMs: Date.now() - startedAtMs });

    const timeoutId = window.setTimeout(() => settleWithFailure("TIMEOUT"), timeoutMs);

    // 💡 최초 실패(권한 없음/위치 서비스 꺼짐)는 콜백이 아니라 addWatcher()가 돌려준
    // 프로미스의 reject로 오기도 해서(checkGeolocationFailureReason 참고) 둘 다 본다.
    BackgroundGeolocation.addWatcher(
      // 오래된 좌표(예: 집에서 잡힌 위치)로 출퇴근을 기록하면 의미가 없다 — 새 측위만 받는다
      { requestPermissions: true, stale: false },
      (position, error) => {
        if (error || !position) {
          settleWithFailure(failureFromNativeError(error));
          return;
        }
        markNativeLocationSucceeded();
        settle({
          coordinates: {
            lat: position.latitude,
            lng: position.longitude,
            accuracy: Number.isFinite(position.accuracy) ? position.accuracy : null,
            simulated: position.simulated,
          },
          failure: null,
          elapsedMs: Date.now() - startedAtMs,
        });
      },
    )
      .then((id) => {
        if (settled) {
          BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
        } else {
          watcherId = id;
        }
      })
      .catch((error) => settleWithFailure(failureFromNativeError(error)));
  });
};

/**
 * 출퇴근 등록 직전에 현재 위치를 한 번 읽고, 실패했으면 그 이유와 걸린 시간도 같이 돌려줍니다.
 * 하이브리드 앱에서는 네이티브 GPS, 웹에서는 브라우저 Geolocation API를 씁니다.
 *
 * 서버는 좌표가 없으면 LOCATION_REQUIRED로 출퇴근 자체를 막으므로(근무지 확인·안전
 * 관리의 전제), 호출부는 coordinates가 null일 때 그 실패를 사용자에게 안내해야 합니다.
 */
export const readCurrentLocation = (): Promise<LocationReading> =>
  Capacitor.isNativePlatform() ? readCurrentLocationFromNative() : readCurrentLocationFromBrowser();

/**
 * 현재 위치를 한 번 읽습니다. 권한 거부·측위 실패·타임아웃·미지원 등 어떤 이유로든
 * 못 읽으면 null을 돌려줍니다(실패 이유가 필요하면 readCurrentLocation을 쓰세요).
 */
export const readCurrentCoordinates = async (): Promise<Coordinates | null> =>
  (await readCurrentLocation()).coordinates;

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
      if (watcherId !== null) {
        BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
      }
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

    // 콜백이 끝내 안 오는 경우(플러그인 미탑재 등)를 대비한 안전장치. stale:true라
    // 정상 케이스는 이 시간을 다 기다리지 않고 훨씬 먼저 settle되므로 짧게 잡아도 된다.
    setTimeout(() => settle("other"), 1500);
  });
};

// 💡 android/app에 직접 작성한 로컬 네이티브 플러그인 — 별도 npm 패키지가 아니라 이
// 프로젝트 안에만 있어서 타입도 여기서 직접 선언한다. 기기 위치 서비스(GPS 토글)
// 켜짐 여부를 실제 위치를 기다리지 않고 즉시 확인하고, 안드로이드에서는 설정 화면으로
// 안 보내고 앱 안에서 시스템 다이얼로그로 바로 켤 수도 있다(iOS는 애플 정책상 앱이
// 대신 켤 수 없어 이 기능이 없다 — 항상 설정 화면으로 보내야 한다).
interface LocationServicesPlugin {
  isEnabled(): Promise<{ enabled: boolean }>;
  requestEnable(): Promise<{ enabled: boolean }>;
}

const LocationServicesNative = registerPlugin<LocationServicesPlugin>("LocationServices");

/**
 * 기기 위치 서비스가 켜져있는지 즉시(부작용 없이) 확인합니다. 안드로이드에서만 의미가
 * 있고, iOS/웹에서는 확인할 방법이 없어 항상 true를 돌려줍니다(그 경우 호출부는
 * readCurrentCoordinates로 실제 시도해보고 실패하면 checkGeolocationFailureReason으로
 * 판단하는 기존 경로를 그대로 타면 됩니다).
 */
export const isLocationServicesEnabled = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() !== "android") return true;
  try {
    const { enabled } = await LocationServicesNative.isEnabled();
    return enabled;
  } catch {
    return true;
  }
};

/**
 * 안드로이드에서 설정 화면으로 보내지 않고 시스템 다이얼로그로 위치를 바로 켭니다.
 * 사용자가 켜면 true, 취소하거나(iOS 등) 지원하지 않는 플랫폼이면 false를 돌려줍니다.
 */
export const requestEnableLocationServices = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() !== "android") return false;
  try {
    const { enabled } = await LocationServicesNative.requestEnable();
    return enabled;
  } catch {
    return false;
  }
};

export const formatDistanceM = (distanceM: number): string =>
  distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${distanceM}m`;
