// 관리자 웹과 관리자 앱이 같은 API 파일을 쓰므로, 서버 주소처럼 앱마다 다른 값은
// 패키지 안에서 정하지 않고 각 앱이 시작할 때 configureClient()로 넣어준다.
type ClientConfig = {
  baseUrl: string;
  // 관리자 앱만 넣는다 — PC 웹은 쿠키로 인증하고, 앱은 접속 토큰을 Authorization 헤더로
  // 보낸다. 401이 나면 refreshAccessToken으로 한 번 갱신해서 같은 요청을 다시 보낸다.
  tokenAuth?: {
    getAccessToken: () => string | null;
    refreshAccessToken: () => Promise<boolean>;
  };
};

let config: ClientConfig | null = null;

export const configureClient = (nextConfig: ClientConfig) => {
  config = nextConfig;
};

export const getBaseUrl = () => {
  if (!config) throw new Error("configureClient()가 호출되지 않았습니다.");
  return config.baseUrl;
};

let onUnauthorized: (() => void) | null = null;

export const setOnUnauthorized = (handler: () => void) => {
  onUnauthorized = handler;
};

// 접속 토큰이 동시에 여러 요청에서 만료돼도 갱신은 한 번만 한다 — 갱신 토큰은 한 번
// 쓰면 끝이라(재사용하면 서버가 그 폰의 로그인을 통째로 끊는다) 두 번 보내면 안 된다.
let refreshInFlight: Promise<boolean> | null = null;

const refreshAccessTokenOnce = () => {
  if (!config?.tokenAuth) return Promise.resolve(false);
  refreshInFlight ??= config.tokenAuth.refreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

const send = (path: string, options: RequestInit) => {
  const accessToken = config?.tokenAuth?.getAccessToken();
  return fetch(`${getBaseUrl()}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    },
  });
};

// PC 웹은 로그인 성공 시 서버가 내려준 httpOnly 세션 쿠키로 인증된다 — 브라우저가 쿠키를
// 함께 보내야 하므로 credentials: "include". 관리자 앱은 configureClient의 tokenAuth로
// 접속 토큰을 Authorization 헤더에 실어 보낸다.
export const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await send(path, options);
    if (response.status === 401 && config?.tokenAuth && (await refreshAccessTokenOnce())) {
      response = await send(path, options);
    }
  } catch (error) {
    console.error(`요청 실패 (${path}):`, error);
    throw new Error("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.", { cause: error });
  }

  // 401(세션 만료/미로그인)만 로그아웃 처리한다 — 403(로그인은 됐지만 이 리소스에
  // 접근 권한이 없음)까지 같이 로그아웃시키면, 담당 아닌 사업단에 들어가려다
  // 403을 받은 것뿐인데 세션이 끊긴 것처럼 보여 혼란을 준다. 403은 아래
  // !response.ok 처리로 흘려보내 백엔드가 보낸 실제 사유를 그대로 던진다.
  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error("로그인이 필요합니다.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `요청 실패 (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};
