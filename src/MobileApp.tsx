import { useEffect } from "react";

import Main from "./pages/Main";

import { startGeofenceTracking, stopGeofenceTracking } from "./utils/geofence";

import "./App.css";

function MobileApp() {
  useEffect(() => {
    const initPWAFeatures = async () => {
      // 1. 서비스 워커 등록
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/sw.js");
          console.log("서비스 워커 등록 완료");
        } catch (err) {
          console.error("서비스 워커 등록 실패:", err);
        }
      }

      // 2. 알림 권한 확인 후 위치 추적 시작
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        startGeofenceTracking();
      } else {
        console.warn("알림 권한이 거부되었습니다.");
      }
    };

    initPWAFeatures();

    // 3. 클린업 함수: 컴포넌트가 꺼질 때 GPS 작동 종료
    return () => {
      stopGeofenceTracking();
    };
  }, []);

  return (
    <div className="app">
      <Main />
    </div>
  );
}

export default MobileApp;
