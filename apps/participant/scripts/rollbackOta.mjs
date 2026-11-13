import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApiBaseUrl, loginAndGetSessionCookie, requireEnv } from "./otaClient.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const apiBaseUrl = resolveApiBaseUrl(path.join(ROOT, ".env.production"));
const email = process.env.OTA_ADMIN_EMAIL;
const password = process.env.OTA_ADMIN_PASSWORD;
const targetId = process.argv[2];

if (!apiBaseUrl) {
  console.error("OTA_API_BASE_URL을 지정하거나 .env.production에 VITE_API_BASE_URL을 설정해주세요.");
  process.exit(1);
}
requireEnv(email, password);

const sessionCookie = await loginAndGetSessionCookie(apiBaseUrl, email, password);

if (!targetId) {
  const listResponse = await fetch(`${apiBaseUrl}/api/ota-bundles`, {
    headers: { Cookie: sessionCookie },
  });
  if (!listResponse.ok) {
    console.error("목록 조회 실패:", await listResponse.text());
    process.exit(1);
  }
  const bundles = await listResponse.json();
  console.log("배포 이력 (최신순):");
  for (const bundle of bundles) {
    const marker = bundle.isActive ? " (현재 활성)" : "";
    console.log(`  id=${bundle.id}  version=${bundle.version}  ${bundle.createdAt}${marker}`);
  }
  console.log("\n되돌릴 id를 지정해 다시 실행해주세요: node scripts/rollbackOta.mjs <id>");
  process.exit(0);
}

const activateResponse = await fetch(`${apiBaseUrl}/api/ota-bundles/${targetId}/activate`, {
  method: "POST",
  headers: { Cookie: sessionCookie },
});
if (!activateResponse.ok) {
  console.error("롤백 실패:", await activateResponse.text());
  process.exit(1);
}
const result = await activateResponse.json();
console.log(`버전 ${result.version}(id=${targetId})으로 롤백했습니다.`);
