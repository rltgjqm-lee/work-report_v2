import type { AdminSession } from "../types";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL;

let onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (handler: () => void) => {
  onUnauthorized = handler;
};

// Cloudflare Access가 이 Worker 앞단에서 로그인을 처리하고 CF-Access-JWT-Assertion을
// 요청에 실어 보낸다 — 브라우저가 그 인증 쿠키를 함께 보내야 하므로 credentials: "include".
// 클라이언트가 직접 토큰을 들고 있거나 Authorization 헤더를 붙이는 부분은 없다.
export const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

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
