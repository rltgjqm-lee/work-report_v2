import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.workreport.senioractivity",
  appName: "활동 일지",
  webDir: "dist-hybrid",
  android: {
    // 백그라운드 위치 감시(@capacitor-community/background-geolocation)가 백그라운드
    // 5분 후 끊기는 문제를 막기 위한 필수 설정 — 끄면 근무 중 관제가 5분만 동작한다.
    // https://github.com/capacitor-community/background-geolocation/issues/89
    useLegacyBridge: true,
  },
};

export default config;
