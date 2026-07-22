import { BASE_URL, request } from "./client";

// client.ts의 request()는 401/403을 전부 "접근 권한이 없습니다"로 뭉뚱그려 던지는데,
// 로그인 실패는 이유(비밀번호 오류/잠금 등)를 그대로 사용자에게 보여줘야 하므로
// 여기서는 그 인터셉터를 거치지 않고 직접 fetch한다.
export const login = async (email: string, password: string) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || "로그인에 실패했습니다.");
  }

  return res.json() as Promise<{ ok: true }>;
};

export const logout = () =>
  request<{ ok: true }>("/auth/logout", { method: "POST" });
