// 관리자 콘솔(admin.worksafe.co.kr) 전용 서비스워커 — register("/sw.js", { scope: "/" })로 등록한다.
// 이 도메인에는 관리자 콘솔만 있어서 사이트 전체 스코프여도 참여자 앱엔 영향이 없다.
//
// fetch 핸들러는 의도적으로 안 만든다 — 예전 참여자용 sw.js가 network-first 캐싱으로
// 모든 요청(admin 포함)을 가로채 사고가 난 적이 있어서(2026-08-11 제거, bb67bbe) 완전히
// 같은 패턴을 반복하지 않기 위함이다. 이 서비스워커는 push 알림 수신/클릭만 처리한다.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();

  event.waitUntil(
    self.registration.showNotification(data.title ?? "🚨 알림", {
      body: data.body ?? "",
      icon: "/icons/app-icon-1024.png",
      tag: "admin-alert",
      renotify: true,
      // url이 있으면(예: SOS는 사업단+참여자 이름까지 실어 보낸다) 클릭 시 그 경로로
      // 이동한다 — 없으면 기본 안전 관제 화면으로 보낸다.
      data: { url: data.url ?? "/escapes" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/escapes";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 이미 관리자 콘솔 탭이 열려있으면 보고 있던 화면 그대로 두지 않고, 알림이 가리키는
      // 화면으로 이동시킨 뒤 포커스한다 — 알림을 클릭했는데 엉뚱한 화면이 그대로면 헷갈리므로.
      const adminClient = clientList[0];
      if (adminClient && "navigate" in adminClient) {
        return adminClient
          .navigate(targetUrl)
          .then((navigatedClient) => (navigatedClient ?? adminClient).focus());
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
