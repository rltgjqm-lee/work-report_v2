export type SendFcmResult = { ok: true } | { ok: false; expired: boolean; status: number };

type ServiceAccountKey = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const base64UrlEncode = (data: ArrayBuffer | string): string => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const importPrivateKey = async (pem: string): Promise<CryptoKey> => {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemBody), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
};

const signJwt = async (serviceAccount: ServiceAccountKey): Promise<string> => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );

  return `${unsigned}.${base64UrlEncode(signature)}`;
};

// FCM HTTP v1 API 호출용 OAuth 액세스 토큰 발급(1시간 유효) — 실행 1회당 한 번만 발급해서
// 그 실행 안의 모든 발송에 재사용한다(체크아웃마다 새로 발급하면 불필요한 subrequest 낭비).
export const getFcmAccessToken = async (
  serviceAccountKeyJson: string,
): Promise<{ accessToken: string; projectId: string }> => {
  const serviceAccount = JSON.parse(serviceAccountKeyJson) as ServiceAccountKey;
  const jwt = await signJwt(serviceAccount);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`FCM 액세스 토큰 발급 실패: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string };
  return { accessToken: data.access_token, projectId: serviceAccount.project_id };
};

export const sendFcmPush = async (
  projectId: string,
  accessToken: string,
  deviceToken: string,
  payload: { title: string; body: string },
): Promise<SendFcmResult> => {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: { token: deviceToken, notification: payload },
    }),
  });

  if (res.ok) return { ok: true };

  // 삭제되었거나 더 이상 유효하지 않은 토큰(UNREGISTERED/NOT_FOUND) — 만료로 간주해 DB에서 정리한다.
  const body = await res.text();
  const expired = body.includes("UNREGISTERED") || body.includes("NOT_FOUND");
  return { ok: false, expired, status: res.status };
};
