const CACHE_NAME = "senior-pwa-v3";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  // "./style.css?v=1.2",
  // "./app.js?v=1.2",
  // "./manifest.json",
  // "./WorkRe.png",
  // "./WorkRe.ico",
  // "./html2pdf.bundle.min.js",
  // "./exceljs.min.js",
];

// 1. 설치 단계: 개별 캐싱 (하나 실패해도 페이지는 뜨게 함)
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(ASSETS_TO_CACHE.map((url) => cache.add(url)));
    }),
  );
});

// 2. 활성화 단계: 제어권 즉시 획득
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// 3. 실행 단계: 네트워크 우선 -> 실패 시 캐시
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 네트워크 성공 시 캐시 업데이트
        const clone = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // 네트워크 실패(비행기 모드) 시에만 캐시 사용
        return caches.match(event.request).then((res) => {
          return res || caches.match("./index.html"); // 캐시에도 없으면 기본 페이지
        });
      }),
  );
});

// 4. 반경 이탈 알림 클릭 처리 이벤트
self.addEventListener("notificationclick", (event) => {
  event.notification.close(); // 사용자가 클릭하면 상단 바에서 알림 창을 닫음

  event.waitUntil(
    // 현재 열려 있는 브라우저 탭/창 목록 확인
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 이미 앱이 켜져 있다면 해당 화면으로 강제 포커스(이동)
        for (const client of clientList) {
          // 도메인의 루트나 특정 페이지에 매칭되는 창이 있다면 포커스
          if (
            (client.url.endsWith("/") || client.url.includes("index.html")) &&
            "focus" in client
          ) {
            return client.focus();
          }
        }
        // 앱이 완전히 닫혀 있는 상태라면 새 창으로 앱을 열어줌
        if (clients.openWindow) {
          return clients.openWindow("./");
        }
      }),
  );
});
