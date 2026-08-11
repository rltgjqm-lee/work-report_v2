import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";

// sw.js를 등록하던 코드는 지웠지만(2026-07-18), 그 전에 등록된 브라우저는 계속
// 그 서비스워커를 실행 중이라 /admin을 포함한 모든 요청을 가로챈다 — 남은 등록을 정리한다.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
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
