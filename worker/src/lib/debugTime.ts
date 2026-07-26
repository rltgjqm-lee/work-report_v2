import type { Context } from "hono";

// 로컬 개발(wrangler dev, http://localhost:8787)에서만 출퇴근 테스트용 시간
// override("HH:MM")를 허용한다. 배포된 워커는 호스트가 localhost가 아니므로
// 요청에 debugTime이 실려와도 무시하고 실제 KST 시각을 쓴다.
export const readDebugTime = (
  c: Context,
  body: { debugTime?: string },
): string | undefined => {
  if (!body.debugTime) return undefined;
  const hostname = new URL(c.req.url).hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return undefined;
  return body.debugTime;
};
