import { secureStore } from "./secureStore";

// 관리자 앱 로그인 토큰 — 서버(/auth/app/*)는 접속 토큰(1시간)과 갱신 토큰(30일)을 준다.
// 접속 토큰은 메모리에만 두고, 갱신 토큰은 Keystore(secureStore)에 둔다. 갱신 토큰은 한 번
// 쓰면 서버가 새 걸로 바꿔주고, 이미 쓴 걸 다시 보내면 그 폰의 로그인을 통째로 끊는다.

type AppTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

const baseUrl = import.meta.env.VITE_API_BASE_URL;

let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

const postJson = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
  try {
    return await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(`요청 실패 (${path}):`, error);
    throw new Error("서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.", { cause: error });
  }
};

const readError = async (response: Response, fallback: string) => {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error || fallback;
};

const saveTokens = async (tokens: AppTokens) => {
  // 새 갱신 토큰을 먼저 저장한다 — 서버는 이미 예전 걸 쓴 것으로 표시했으니 놓치면 다시 로그인해야 한다
  await secureStore.setRefreshToken(tokens.refreshToken);
  accessToken = tokens.accessToken;
};

export const loginWithPassword = async (email: string, password: string) => {
  const response = await postJson("/auth/app/login", { email, password });
  if (!response.ok) {
    throw new Error(await readError(response, "로그인에 실패했습니다."));
  }
  await saveTokens((await response.json()) as AppTokens);
};

let refreshInFlight: Promise<boolean> | null = null;

// 접속 토큰을 새로 받는다. 갱신 토큰이 만료·폐기됐으면 false(다시 로그인해야 함),
// 네트워크 문제면 갱신 토큰을 지우지 않고 에러를 던진다(다시 시도하면 된다).
const refreshOnce = async (): Promise<boolean> => {
  const refreshToken = await secureStore.getRefreshToken();
  if (!refreshToken) return false;

  const response = await postJson("/auth/app/refresh", { refreshToken });
  if (response.status === 401 || response.status === 400) {
    accessToken = null;
    return false;
  }
  if (!response.ok) {
    throw new Error(await readError(response, "로그인 연장에 실패했습니다."));
  }
  await saveTokens((await response.json()) as AppTokens);
  return true;
};

export const refreshAccessToken = () => {
  refreshInFlight ??= refreshOnce().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

// 서버에서 이 폰의 접속 토큰·갱신 토큰·FCM 토큰을 지운다. 서버에 못 닿아도 폰에선 지운다.
export const logoutFromServer = async (fcmToken: string | null) => {
  const refreshToken = await secureStore.getRefreshToken();
  try {
    await postJson(
      "/auth/app/logout",
      { refreshToken, fcmToken },
      accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    );
  } catch (error) {
    console.error("로그아웃 요청 실패:", error);
  }
  accessToken = null;
};

export const forgetAccessToken = () => {
  accessToken = null;
};
