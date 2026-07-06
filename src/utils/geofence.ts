import { LOCAL_STORAGE_KEYS } from "../constants/storage";
import logoIcon from "../assets/logo.png";

if (
  typeof window !== "undefined" &&
  !localStorage.getItem(LOCAL_STORAGE_KEYS.TARGET_LAT)
) {
  if ("geolocation" in navigator) {
    // 2. 브라우저에 현재 내 위치(GPS 좌표)를 요청합니다.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLat = position.coords.latitude.toString();
        const currentLon = position.coords.longitude.toString();

        // 3. 성공적으로 받아온 좌표를 localStorage에 저장합니다.
        localStorage.setItem(LOCAL_STORAGE_KEYS.TARGET_LAT, currentLat);
        localStorage.setItem(LOCAL_STORAGE_KEYS.TARGET_LON, currentLon);

        console.log(
          "현재 위치가 새로운 기준점으로 저장되었습니다:",
          currentLat,
          currentLon,
        );

        // 💡 필요하다면 여기에 위치 추적(watchPosition)을 시작하는 함수를 호출하세요.
        // startTracking();
      },
      (error) => {
        console.error(
          "현재 위치를 가져오지 못했습니다. 기본값으로 설정합니다.",
          error,
        );
        // GPS 오류나 거부 발생 시 사용할 대비책(Fallback) 좌표 (예: 서울역)
        localStorage.setItem(LOCAL_STORAGE_KEYS.TARGET_LAT, "37.554648");
        localStorage.setItem(LOCAL_STORAGE_KEYS.TARGET_LON, "126.972559");
      },
      {
        enableHighAccuracy: true, // 높은 정확도로 내 위치 가져오기
        timeout: 5000, // 5초 이내에 위치를 못 가져오면 에러 처리
      },
    );
  } else {
    console.error("이 브라우저는 위치 서비스를 지원하지 않습니다.");
  }
}

const MAX_DISTANCE_KM = 1.5;

let watchId: number | null = null;
let isAlerted = false;

// 하베사인 거리 계산 (직선 거리 리턴)
const getDistanceKM = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// 이탈 알림 발송 및 종료
const triggerGeofenceAlert = (distance: number) => {
  isAlerted = true;

  if (Notification.permission === "granted") {
    navigator.serviceWorker.ready
      .then((registration: ServiceWorkerRegistration) => {
        return registration.showNotification("⚠️ 지정 구역 이탈 경고", {
          body: `설정된 반경으로부터 ${distance.toFixed(2)}km 벗어났습니다.`,
          icon: logoIcon,
          badge: logoIcon,
          tag: "geofence-alert",
          renotify: true,
        } as NotificationOptions);
      })
      .then(() => console.log("알림 발송 완료"))
      .catch((err) => console.error("알림 발송 실패:", err));
  } else {
    console.warn(
      "알림 권한이 없어 알림을 보낼 수 없습니다. 현재 권한 상태:",
      Notification.permission,
    );
  }

  stopGeofenceTracking();
};

// 외부에서 호출할 위치 추적 시작 함수
export const startGeofenceTracking = () => {
  if (!("geolocation" in navigator) || watchId !== null) return;

  isAlerted = false; // 시작할 때 플래그 초기화

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  };

  // Notification.requestPermission().then((permission) => {
  //   if (permission === "granted") {
  //     new Notification("테스트 알림", { body: "알림 기능이 정상 작동합니다!" });
  //   }
  // });

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (isAlerted) return;

      // 💡 위치 업데이트마다 최신 기준점을 읽어와야 Admin 페이지에서 바꾼 값이 즉시 반영됨
      const targetLat = parseFloat(
        localStorage.getItem(LOCAL_STORAGE_KEYS.TARGET_LAT) || "0",
      );
      const targetLon = parseFloat(
        localStorage.getItem(LOCAL_STORAGE_KEYS.TARGET_LON) || "0",
      );

      const distance = getDistanceKM(
        targetLat,
        targetLon,
        position.coords.latitude,
        position.coords.longitude,
      );
      console.log(`현재 거리: ${distance.toFixed(2)}km`);

      if (distance > MAX_DISTANCE_KM) {
        triggerGeofenceAlert(distance);
      }
    },
    (error) => console.error("위치 추적 실패:", error),
    options,
  );
  console.log("지오펜싱 위치 추적이 시작되었습니다.");
};

// 외부에서 호출할 위치 추적 종료 함수 (메모리 누수 방지용)
export function stopGeofenceTracking(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    console.log("지오펜싱 위치 추적이 안전하게 종료되었습니다.");
  }
}
