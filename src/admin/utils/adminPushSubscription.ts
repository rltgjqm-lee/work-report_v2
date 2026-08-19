import { subscribeToPush } from "../api/admin/pushSubscriptions";

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// 관리자 콘솔 진입(AdminLayout 마운트) 시 호출 — /admin 스코프로 좁힌 서비스워커만
// 등록하므로(public/admin/sw.js) 참여자 앱 쪽엔 전혀 영향이 없다. 이미 허용/구독된
// 상태면 권한 팝업 없이 조용히 같은 구독을 다시 upsert할 뿐이라 반복 호출해도 무해하다.
export const subscribeAdminToPush = async (): Promise<void> => {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        import.meta.env.VITE_VAPID_PUBLIC_KEY,
      ) as BufferSource,
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    await subscribeToPush({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
  } catch (error) {
    console.error("관리자 웹 푸시 구독 등록 실패:", error);
  }
};
