import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import App from "./App.tsx";

import "./index.css";

// 배포 직후 열려있던 탭이 lazy(() => import(...)) 청크를 요청하면, 그 청크는 이전
// 빌드 해시라 서버(Pages)에 더 이상 없다 — SPA 폴백이 index.html(text/html)을 대신
// 돌려주면서 "Expected a JavaScript module" 에러가 난다. Vite가 이런 실패를
// vite:preloadError로 알려주므로, 최신 index.html을 다시 받도록 새로고침한다.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
