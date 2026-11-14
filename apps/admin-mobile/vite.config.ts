import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 관리자 앱(Android, Capacitor) 빌드. 브라우저로 화면을 볼 땐 참여자 앱(5173)·관리자 웹(5174)과
// 같이 띄울 수 있게 5175로 고정한다 — Worker의 ALLOWED_ORIGINS에 이 포트가 등록돼 있다.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  server: {
    port: 5175,
    strictPort: true,
  },
});
