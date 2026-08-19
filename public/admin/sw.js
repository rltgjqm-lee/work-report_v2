// 관리자 콘솔 전용 서비스워커 — navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" })
// 로만 등록되므로 /admin 밖 화면(참여자 앱 포함)엔 영향이 없다.
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
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/admin") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/admin/escapes");
      }
    }),
  );
});
