import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import { registerMyDevice } from "@work-report/admin-core/api/me";

// SOS 앱 알림(FCM). Worker는 data만 보내고 알림·알림 채널은 네이티브(SosAlarm.java)가 직접 만든다.

// Worker가 data에 넣어 보내는 값(apps/worker/src/routes/user/public.ts) — 전부 문자열이다
export type SosPushData = {
  type?: string;
  sosEventId?: string;
  programId?: string;
  participantName?: string;
};

export type PushPermission = "granted" | "denied" | "unsupported";

let currentFcmToken: string | null = null;

export const getCurrentFcmToken = () => currentFcmToken;

type PushHandlers = {
  // 앱이 떠 있을 때 알림이 왔다 — 시스템 알림 대신 앱 안에서 화면 전체로 보여준다(SosAlertScreen)
  onReceived: (data: SosPushData) => void;
  // 알림을 눌러 앱을 열었다(앱이 꺼져 있었어도 Capacitor가 이 이벤트를 남겨뒀다가 준다)
  onOpened: (data: SosPushData) => void;
};

// 알림 리스너는 잠금 해제 전, 앱이 뜨자마자 붙인다 — 알림을 눌러 앱을 연 경우
// 잠금을 푼 뒤 그 SOS 화면으로 바로 보내기 위함이다.
export const listenToPushNotifications = async (handlers: PushHandlers) => {
  if (!Capacitor.isNativePlatform()) return () => {};

  const handles = await Promise.all([
    PushNotifications.addListener("registration", (token) => {
      currentFcmToken = token.value;
      registerMyDevice(token.value).catch((error) => {
        console.error("FCM 토큰 등록 실패:", error);
      });
    }),
    PushNotifications.addListener("registrationError", (error) => {
      console.error("FCM 등록 실패:", error);
    }),
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      handlers.onReceived((notification.data ?? {}) as SosPushData);
    }),
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      handlers.onOpened((action.notification.data ?? {}) as SosPushData);
    }),
  ]);

  return () => {
    handles.forEach((handle) => handle.remove());
  };
};

// 잠금을 푼 뒤(접속 토큰이 생긴 뒤) 부른다 — Android 13+ 알림 권한을 묻고,
// FCM 토큰을 받으면 registration 리스너가 서버에 등록한다.
export const registerForPushNotifications = async (): Promise<PushPermission> => {
  if (!Capacitor.isNativePlatform()) return "unsupported";

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== "granted") return "denied";

  await PushNotifications.register();
  return "granted";
};

export const checkPushPermission = async (): Promise<PushPermission> => {
  if (!Capacitor.isNativePlatform()) return "unsupported";
  const permission = await PushNotifications.checkPermissions();
  return permission.receive === "granted" ? "granted" : "denied";
};
