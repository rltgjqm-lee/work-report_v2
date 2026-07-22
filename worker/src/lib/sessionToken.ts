// 세션 토큰 발급/해싱 — 쿠키엔 이 원문 토큰만 담고, DB(admin_sessions.tokenHash)엔
// SHA-256 해시만 저장한다. 세션 토큰 자체가 256비트 랜덤이라 무차별 대입은 사실상
// 불가능하지만, DB 유출 시에도 세션을 그대로 재사용 못 하게 하는 방어층을 더한다.
export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const generateSessionToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes.buffer as ArrayBuffer);
};

export const hashSessionToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return toHex(digest);
};

// 프론트(Pages)와 API(Workers)가 서로 다른 도메인이라 프로덕션에서는 크로스사이트
// 쿠키가 필요하다 — SameSite=None은 Secure(https)가 아니면 브라우저가 거부하므로,
// 로컬 wrangler dev(http)에서는 대신 Lax+Secure(false)를 쓴다.
export const getSessionCookieAttrs = (requestUrl: string) => {
  const isHttps = requestUrl.startsWith("https://");
  return isHttps
    ? { secure: true, sameSite: "None" as const }
    : { secure: false, sameSite: "Lax" as const };
};
