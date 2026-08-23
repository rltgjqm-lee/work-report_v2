export const BASE_URL = import.meta.env.VITE_API_BASE_URL;

let onUnauthorized: (() => void) | null = null;

export const setOnUnauthorized = (handler: () => void) => {
  onUnauthorized = handler;
};

// 로그인 성공 시 서버가 httpOnly 세션 쿠키를 내려주고, 이후 요청은 그 쿠키로 인증된다 —
// 브라우저가 쿠키를 함께 보내야 하므로 credentials: "include". 클라이언트가 토큰을
// 직접 들고 있거나 Authorization 헤더를 붙이는 부분은 없다.
export const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    console.error(`요청 실패 (${path}):`, error);
    throw new Error("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
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
