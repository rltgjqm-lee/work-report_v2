import { fileURLToPath } from "url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Capacitor(iOS/Android) 앱에 담을 활동일지 플로우 전용 빌드.
// 관리자 콘솔(App.tsx의 BrowserRouter/AdminApp)을 아예 엔트리에서 배제해
// 네이티브 번들에 관리자 코드가 섞여 들어가지 않게 한다.
// root는 프로젝트 루트를 그대로 쓴다 — Tailwind v4의 자동 콘텐츠 스캔이 root 기준이라,
// root를 하위 폴더로 옮기면 src/의 클래스명을 못 읽어 유틸리티 클래스가 통째로 빠진다.
// 대신 엔트리 파일명은 index.html과 겹치지 않게 hybrid.html로 두고, 빌드 후
// package.json의 build:hybrid 스크립트에서 dist-hybrid/hybrid.html → index.html로
// 이름을 바꿔 Capacitor가 webDir 루트에서 index.html을 찾도록 한다.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  build: {
    outDir: "dist-hybrid",
    rollupOptions: {
      input: fileURLToPath(new URL("./hybrid.html", import.meta.url)),
    },
  },
});
