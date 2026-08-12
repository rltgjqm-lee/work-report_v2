import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.workreport.senioractivity",
  appName: "Work Report",
  webDir: "dist-hybrid",
  android: {
    // 백그라운드 위치 감시(@capacitor-community/background-geolocation)가 백그라운드
    // 5분 후 끊기는 문제를 막기 위한 필수 설정 — 끄면 근무 중 관제가 5분만 동작한다.
    // https://github.com/capacitor-community/background-geolocation/issues/89
    useLegacyBridge: true,
  },
  plugins: {
    // 우리가 checkAndApplyOtaUpdate에서 자체 서버로 직접 확인/적용하므로, 플러그인
    // 내장 자동 업데이트(기본값 Capgo 클라우드로 핑)는 꺼서 불필요한 외부 호출을 막는다.
    CapacitorUpdater: {
      autoUpdate: false,
    },
  },
};

export default config;
