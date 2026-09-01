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

// 💡 앱을 켜자마자(참여자가 아직 확정되기 전) 알림 권한 다이얼로그부터 띄운다 — 참여자와
// 묶어 서버에 토큰을 등록하는 registerNativePush와 달리, 여기선 OS 권한만 먼저 받아둔다.
// 이미 허용/거부가 결정된 상태면 다이얼로그 없이 조용히 끝난다. 참여자가 정해진 뒤
// registerNativePush가 다시 호출되면 그때는 새 다이얼로그 없이 바로 토큰을 등록한다.
export const requestNativePushPermission = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.requestPermissions();
  } catch (error) {
    console.error("네이티브 알림 권한 요청 실패:", error);
  }
};

// 대시보드는 Main.tsx의 view 전환마다(업무/안전 등록 화면 오갈 때마다) 매번 새로 마운트되고,
// 그때마다 registerNativePush가 다시 호출된다 — 이 세션에서 이미 성공적으로 등록한
// 참여자는 다시 서버에 upsert를 보내지 않게 걸러낸다. 모듈 스코프 변수라 앱을 완전히
// 새로 켜면(모듈이 다시 로드되면) 초기화되므로, 아래 "실패 시 재시도" 안전망은 그대로
// 유지된다 — 실패한 시도는 여기 추가하지 않아서 다음 리마운트에서 다시 시도된다.
const registeredThisSession = new Set<number>();

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
  if (registeredThisSession.has(participantId)) return;

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
          registeredThisSession.add(participantId);
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
