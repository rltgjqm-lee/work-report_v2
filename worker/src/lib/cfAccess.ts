// Cloudflare Access가 이 Worker의 라우트 앞단에서 로그인을 처리하고, 통과한 요청에
// CF-Access-JWT-Assertion 헤더(RS256 JWT)를 실어 보낸다. 이 헤더는 클라이언트가
// 얼마든지 위조해서 보낼 수 있으므로, Cloudflare가 공개하는 JWKS로 서명을 직접
// 검증한 뒤에만 email 클레임을 신뢰한다 (헤더를 그냥 디코드만 하고 믿으면 안 됨).

type Jwk = JsonWebKey & { kid?: string };

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

const base64UrlToUint8Array = (b64url: string): Uint8Array => {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

const decodeJson = (b64url: string): Record<string, unknown> =>
  JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(b64url)));

const getJwks = async (teamDomain: string): Promise<Jwk[]> => {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }

  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) {
    throw new Error(`Access JWKS 조회 실패: ${res.status}`);
  }
  const data = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: data.keys, fetchedAt: now };
  return data.keys;
};

/**
 * CF-Access-JWT-Assertion 헤더를 검증하고 email 클레임을 반환한다.
 * 서명/aud/exp가 유효하지 않으면 null.
 */
export const verifyAccessJwt = async (
  token: string,
  teamDomain: string,
  aud: string,
): Promise<string | null> => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = decodeJson(headerB64) as { kid?: string; alg?: string };
  const payload = decodeJson(payloadB64) as {
    email?: string;
    aud?: string[] | string;
    exp?: number;
  };

  if (header.alg !== "RS256" || !header.kid) return null;

  const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audList.includes(aud)) return null;

  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  if (!payload.email) return null;

  const jwks = await getJwks(teamDomain);
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signature = base64UrlToUint8Array(signatureB64);
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedData,
  );

  return valid ? payload.email : null;
};
