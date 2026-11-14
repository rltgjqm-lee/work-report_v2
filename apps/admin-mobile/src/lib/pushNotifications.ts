import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import { registerMyDevice } from "@work-report/admin-core/api/me";

// SOS 앱 알림(FCM). Worker가 channel_id "sos"로 보내므로 같은 id의 채널을 앱이 먼저 만들어
// 둬야 한다. 소리·진동·방해금지 예외는 관리자가 휴대폰 알림 설정에서 이 채널을 직접 바꾼다.
export const SOS_CHANNEL_ID = "sos";

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
  // 앱이 떠 있을 때 알림이 왔다 — 시스템 알림 대신 화면 위 배너로 보여준다
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

// 잠금을 푼 뒤(접속 토큰이 생긴 뒤) 부른다 — 채널을 만들고, Android 13+ 알림 권한을 묻고,
// FCM 토큰을 받으면 registration 리스너가 서버에 등록한다.
export const registerForPushNotifications = async (): Promise<PushPermission> => {
  if (!Capacitor.isNativePlatform()) return "unsupported";

  await PushNotifications.createChannel({
    id: SOS_CHANNEL_ID,
    name: "SOS 알림",
    description: "참여자가 SOS를 누르면 바로 알려드려요",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
  });

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
