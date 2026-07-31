import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

// 💡 사업단 선택 시 호출 — 하이브리드 앱(iOS/Android)에서 네이티브 푸시 토큰을 등록한다
// (웹에서는 아무 것도 하지 않는다. 실패해도 초기설정 저장 흐름은 막지 않는다).
// 실제 FCM/APNs 발송 연동 전까지는 토큰을 서버에 저장만 해둔다.
export const registerNativePush = async (programId: number): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const permissionStatus = await PushNotifications.requestPermissions();
    if (permissionStatus.receive !== "granted") return;

    await new Promise<void>((resolve) => {
      PushNotifications.addListener("registration", async (token) => {
        try {
          await fetch(`${import.meta.env.VITE_API_BASE_URL}/public/push-device-tokens`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              programId,
              platform: Capacitor.getPlatform(),
              token: token.value,
            }),
          });
        } catch (error) {
          console.error("네이티브 푸시 토큰 서버 등록 실패:", error);
        } finally {
          resolve();
        }
      });

      PushNotifications.addListener("registrationError", (error) => {
        console.error("네이티브 푸시 등록 실패:", error);
        resolve();
      });

      PushNotifications.register();
    });
  } catch (error) {
    console.error("네이티브 푸시 권한 요청 실패:", error);
  }
};
