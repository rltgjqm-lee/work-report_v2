import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.workreport.admin",
  appName: "워크 세이프 관리자",
  webDir: "dist",
  android: {
    // targetSdk 35부터 Android 15는 화면을 상태바·내비게이션 바 밑까지 강제로 넓힌다 —
    // 웹 화면이 그 밑에 깔리지 않도록 Capacitor가 여백을 넣게 한다.
    adjustMarginsForEdgeToEdge: "auto",
  },
  plugins: {
    // 앱이 앞에 떠 있을 때 온 알림은 시스템 알림 대신 화면 위 배너로 보여준다(SosAlertBanner)
    PushNotifications: {
      presentationOptions: [],
    },
  },
};

export default config;
