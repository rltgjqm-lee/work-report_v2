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

/**
 * LOCATION_REQUIRED로 출퇴근이 막혔을 때만 호출해서 실패 이유를 구분합니다.
 *
 * "권한 자체가 꺼져있다"(다시 시도해도 절대 안 됨)와 "실내라 순간적으로 못 잡았다"
 * (다시 시도하면 될 수 있음)를 구분해야, 전자일 때 무의미한 재시도 루프 대신 OS
 * 설정으로 안내할 수 있습니다.
 */
export const checkGeolocationPermissionDenied = (): Promise<boolean> => {
  if (!navigator.geolocation) return Promise.resolve(false);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(false),
      (error) => resolve(error.code === error.PERMISSION_DENIED),
      { timeout: 3000, maximumAge: 60_000 },
    );
  });
};
