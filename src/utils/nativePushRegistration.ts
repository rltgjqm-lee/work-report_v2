import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

// 💡 등록확인 화면은 참여자id가 로컬에 남아있으면 최초 1회만 거치고 이후로는 건너뛴다
// (Main.tsx 참고) — 그래서 홈 화면이 앱을 켤 때마다 알림 권한 상태만 가볍게 확인해서
// 배너를 보여줄지 판단한다. 권한을 요청하진 않으므로 다이얼로그는 안 뜬다.
export const checkNativePushPermission = async (): Promise<
  "granted" | "denied" | "prompt" | "unsupported"
> => {
  if (!Capacitor.isNativePlatform()) return "unsupported";

  try {
    const status = await PushNotifications.checkPermissions();
    if (status.receive === "granted") return "granted";
    if (status.receive === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
};

// 💡 등록확인 화면에서 출근 식별(이름 확인)에 성공하면 호출 — 하이브리드 앱(iOS/Android)에서
// 네이티브 푸시 토큰을 등록한다(웹에서는 아무 것도 하지 않는다. 실패해도 흐름은 막지 않는다).
// 이 시점엔 참여자가 이미 확정돼 있으므로 토큰을 처음부터 그 참여자와 연결해서 저장한다.
// 홈 화면에서도 앱을 켤 때마다 재시도로 호출한다 — 이미 허용/등록된 상태면 다이얼로그
// 없이 토큰만 조용히 다시 보내고(upsert라 중복 안 생김), 거부 상태면 그냥 아무 일도 안 한다.
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
