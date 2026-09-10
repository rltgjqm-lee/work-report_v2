// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier"; // 1. 플러그인 가져오기
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import storybook from "eslint-plugin-storybook";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettierConfig,
    ],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // 옵션은 .prettierrc.json 에서 읽음 (단일 소스)
      "prettier/prettier": "error",
      // 색상 hex 를 Tailwind 임의값(bg-[#xxxxxx])으로 직접 쓰는 것을 막는다.
      // 2026-08-10 에 65개 파일 901곳을 @theme 토큰으로 걷어냈는데 이후 새 코드에서
      // 다시 15곳이 생겼다. 토큰을 우회하는 경로를 린트로 닫아 재발을 끊는다.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\[#\\w{3}/]",
          message:
            "색상 hex 를 직접 쓰지 않는다. src/App.css 의 @theme 토큰을 쓰거나, 없으면 토큰을 먼저 추가할 것.",
        },
        {
          selector: "TemplateElement[value.raw=/\\[#\\w{3}/]",
          message:
            "색상 hex 를 직접 쓰지 않는다. src/App.css 의 @theme 토큰을 쓰거나, 없으면 토큰을 먼저 추가할 것.",
        },
      ],
    },
  },
  ...storybook.configs["flat/recommended"],
]);
