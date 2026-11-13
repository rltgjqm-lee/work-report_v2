import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 관리자 콘솔(admin.worksafe.co.kr) 빌드. 참여자 앱(5173)과 같이 띄울 수 있게 포트를
// 5174로 고정한다 — Worker의 ALLOWED_ORIGINS에 이 포트가 등록돼 있다.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  server: {
    port: 5174,
    strictPort: true,
  },
});
