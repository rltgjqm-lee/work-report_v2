import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import App from "./App.tsx";

// sw.js를 등록하던 코드는 지웠지만(2026-07-18), 그 전에 등록된 브라우저는 계속
// 그 서비스워커를 실행 중이라 /admin을 포함한 모든 요청을 가로챈다 — 남은 등록을 정리한다.
// 단, /admin/ 스코프로 새로 등록한 관리자 웹 푸시용 서비스워커(public/admin/sw.js)는
// 좀비가 아니라 의도된 등록이라 여기서 같이 해제하면 안 된다.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations
      .filter((registration) => !registration.scope.endsWith("/admin/"))
      .forEach((registration) => registration.unregister());
  });
}
if ("caches" in window) {
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
