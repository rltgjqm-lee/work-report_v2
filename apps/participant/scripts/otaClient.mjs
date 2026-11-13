import { readFileSync } from "node:fs";

// 관리자 콘솔과 같은 이메일+비밀번호 로그인을 그대로 재사용한다 — OTA 배포용 별도 토큰을
// 새로 만들지 않는다.
export const resolveApiBaseUrl = (envProductionPath) =>
  process.env.OTA_API_BASE_URL ?? readEnvValue(envProductionPath, "VITE_API_BASE_URL");

const readEnvValue = (file, key) => {
  const content = readFileSync(file, "utf-8");
  return content.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
};

export const loginAndGetSessionCookie = async (apiBaseUrl, email, password) => {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`로그인 실패: ${await response.text()}`);
  }

  const setCookie = response.headers.get("set-cookie");
  const sessionCookie = setCookie?.split(";")[0];
  if (!sessionCookie) {
    throw new Error("세션 쿠키를 받지 못했습니다.");
  }
  return sessionCookie;
};

export const requireEnv = (email, password) => {
  if (!email || !password) {
    console.error("환경변수 OTA_ADMIN_EMAIL, OTA_ADMIN_PASSWORD를 설정해주세요.");
    process.exit(1);
  }
};
