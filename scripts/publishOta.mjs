import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loginAndGetSessionCookie, requireEnv, resolveApiBaseUrl } from "./otaClient.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_HYBRID = path.join(ROOT, "dist-hybrid");
const ZIP_PATH = path.join(ROOT, "dist-hybrid.zip");

const apiBaseUrl = resolveApiBaseUrl(path.join(ROOT, ".env.production"));
const email = process.env.OTA_ADMIN_EMAIL;
const password = process.env.OTA_ADMIN_PASSWORD;
const version =
  process.argv[2] ?? JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf-8")).version;

if (!apiBaseUrl) {
  console.error(
    "OTA_API_BASE_URL을 지정하거나 .env.production에 VITE_API_BASE_URL을 설정해주세요.",
  );
  process.exit(1);
}
requireEnv(email, password);

// 스토어 앱에 처음부터 들어 있는 번들은 네이티브 앱 버전(안드로이드 versionName, iOS
// MARKETING_VERSION)을 번들 버전으로 쓴다. 서버는 OTA 버전이 그보다 높을 때만 내려주므로
// (worker/src/routes/user/ota.ts), 이보다 낮거나 같은 OTA는 그 스토어 버전 사용자에게 아예
// 안 간다 — 스토어 1.7 사용자가 OTA 1.6.5를 못 받은 적이 있다.
const compareVersions = (a, b) => {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const difference = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

const readNativeVersion = (file, pattern) => {
  if (!existsSync(file)) return null;
  return readFileSync(file, "utf-8").match(pattern)?.[1] ?? null;
};

const nativeVersions = [
  [
    "안드로이드",
    readNativeVersion(path.join(ROOT, "android/app/build.gradle"), /versionName "([\d.]+)"/),
  ],
  [
    "iOS",
    readNativeVersion(
      path.join(ROOT, "ios/App/App.xcodeproj/project.pbxproj"),
      /MARKETING_VERSION = ([\d.]+);/,
    ),
  ],
].filter(([, nativeVersion]) => nativeVersion !== null);

const outdatedAgainst = nativeVersions.filter(
  ([, nativeVersion]) => compareVersions(version, nativeVersion) <= 0,
);
if (outdatedAgainst.length > 0) {
  const details = outdatedAgainst
    .map(([platform, nativeVersion]) => `${platform} 스토어 앱 ${nativeVersion}`)
    .join(", ");
  console.error(
    `OTA 버전 ${version}이 ${details}보다 높지 않습니다. 이대로 올리면 그 스토어 버전 사용자는 ` +
      `이 번들을 받지 못합니다. 더 높은 버전으로 다시 실행해주세요 (예: npm run ota:publish -- <버전>).`,
  );
  process.exit(1);
}

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
