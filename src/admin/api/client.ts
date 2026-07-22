import type { AdminSession } from "../types";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL;

let onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (handler: () => void) => {
  onUnauthorized = handler;
};

// 로그인 성공 시 서버가 httpOnly 세션 쿠키를 내려주고, 이후 요청은 그 쿠키로 인증된다 —
// 브라우저가 쿠키를 함께 보내야 하므로 credentials: "include". 클라이언트가 토큰을
// 직접 들고 있거나 Authorization 헤더를 붙이는 부분은 없다.
export const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
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

  if (res.status === 401 || res.status === 403) {
    onUnauthorized?.();
    throw new Error("접근 권한이 없습니다.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `요청 실패 (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

export const getMe = () => request<AdminSession>("/api/me");
