import { subscribeToPush } from "@work-report/admin-core/api/pushSubscriptions";

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

// 처음 admin.worksafe.co.kr로 옮겼을 때(2026-11-13)는 주소가 /admin/... 이라 서비스워커를
// /admin/ 스코프로 등록했다. 그 등록이 남아 있으면 새 / 스코프 구독과 함께 알림이 두 번
// 울리므로, 구독을 해지하고(푸시 서버가 410을 돌려줘 Worker가 DB에서 지운다) 등록을 지운다.
const removeLegacyAdminScopeRegistration = async () => {
  const registration = await navigator.serviceWorker.getRegistration("/admin/");
  if (!registration || registration.scope !== `${window.location.origin}/admin/`) return;
  const subscription = await registration.pushManager.getSubscription();
  await subscription?.unsubscribe();
  await registration.unregister();
};

// 관리자 콘솔 진입(AdminLayout 마운트) 시 호출 — 이 도메인은 관리자 콘솔 전용이라 서비스워커를
// 사이트 전체(/) 스코프로 등록한다. 이미 허용/구독된 상태면 권한 팝업 없이 조용히 같은 구독을
// 다시 upsert할 뿐이라 반복 호출해도 무해하다.
export const subscribeAdminToPush = async (): Promise<void> => {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    await removeLegacyAdminScopeRegistration();

    await navigator.serviceWorker.register("/sw.js", { scope: "/" });

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
