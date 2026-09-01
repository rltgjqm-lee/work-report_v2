import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/react-vite",
  // 모달/아이콘이 참조하는 /icons/*.png가 public/에 있어 정적 서빙 경로를 명시한다.
  staticDirs: ["../public"],
};
export default config;
