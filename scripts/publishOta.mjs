import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApiBaseUrl, loginAndGetSessionCookie, requireEnv } from "./otaClient.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_HYBRID = path.join(ROOT, "dist-hybrid");
const ZIP_PATH = path.join(ROOT, "dist-hybrid.zip");

const apiBaseUrl = resolveApiBaseUrl(path.join(ROOT, ".env.production"));
const email = process.env.OTA_ADMIN_EMAIL;
const password = process.env.OTA_ADMIN_PASSWORD;
const version =
  process.argv[2] ?? JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf-8")).version;

if (!apiBaseUrl) {
  console.error("OTA_API_BASE_URL을 지정하거나 .env.production에 VITE_API_BASE_URL을 설정해주세요.");
  process.exit(1);
}
requireEnv(email, password);

if (!existsSync(DIST_HYBRID)) {
  console.error("dist-hybrid가 없습니다. 먼저 npm run build:hybrid를 실행해주세요.");
  process.exit(1);
}

console.log(`번들을 압축합니다 (버전 ${version})...`);
execSync(`rm -f "${ZIP_PATH}" && cd "${DIST_HYBRID}" && zip -r -q "${ZIP_PATH}" .`, {
  stdio: "inherit",
});

console.log("관리자로 로그인합니다...");
const sessionCookie = await loginAndGetSessionCookie(apiBaseUrl, email, password);

console.log("번들을 업로드합니다...");
const zipBytes = readFileSync(ZIP_PATH);
const uploadResponse = await fetch(
  `${apiBaseUrl}/api/ota-bundles?version=${encodeURIComponent(version)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/zip", Cookie: sessionCookie },
    body: zipBytes,
  },
);
if (!uploadResponse.ok) {
  console.error("업로드 실패:", await uploadResponse.text());
  process.exit(1);
}
const bundle = await uploadResponse.json();
console.log(`업로드 완료: id=${bundle.id}, version=${bundle.version}`);

console.log("활성화합니다...");
const activateResponse = await fetch(`${apiBaseUrl}/api/ota-bundles/${bundle.id}/activate`, {
  method: "POST",
  headers: { Cookie: sessionCookie },
});
if (!activateResponse.ok) {
  console.error("활성화 실패:", await activateResponse.text());
  process.exit(1);
}

console.log(`버전 ${bundle.version}이 배포되었습니다.`);
