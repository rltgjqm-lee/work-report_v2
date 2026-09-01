import type { Preview } from "@storybook/react-vite";

import "../src/App.css";

// @capacitor/core는 window.CapacitorCustomPlatform이 있으면 getPlatform()이 그 이름을
// 돌려준다 — 이 앱의 실제 배포 타겟이 안드로이드(iOS는 아직 미배포)라, 위치/설정 관련
// 모달의 플랫폼 분기(예: LocationServicesOffModal)를 기본값(web)이 아니라 안드로이드
// 기준으로 보이게 고정한다.
declare global {
  interface Window {
    CapacitorCustomPlatform?: { name: string };
  }
}
window.CapacitorCustomPlatform = { name: "android" };

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
};

export default preview;
