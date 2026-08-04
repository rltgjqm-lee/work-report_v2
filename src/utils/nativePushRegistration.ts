import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

// 💡 등록확인 화면에서 출근 식별(이름 확인)에 성공하면 호출 — 하이브리드 앱(iOS/Android)에서
// 네이티브 푸시 토큰을 등록한다(웹에서는 아무 것도 하지 않는다. 실패해도 흐름은 막지 않는다).
// 이 시점엔 참여자가 이미 확정돼 있으므로 토큰을 처음부터 그 참여자와 연결해서 저장한다.
export const registerNativePush = async (
  programId: number,
  participantId: number,
): Promise<void> => {
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
              participantId,
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
