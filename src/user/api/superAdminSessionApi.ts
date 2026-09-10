import { queryOptions } from "@tanstack/react-query";

// 💡 TEMP(2026-09-10 시연용, 시연 끝나면 이 파일 + 사용처(ActivityDashboardPage.tsx의
// isDebugPanelVisible) 통째로 걷어낼 것.
//
// 같은 브라우저에서 관리자 콘솔에 SUPER_ADMIN으로 로그인해두면, 그 httpOnly 세션 쿠키가
// credentials:"include" 덕에 이 요청에도 같이 실려간다 — 서버(worker/src/lib/debugTime.ts)가
// 이미 배포 서버에서도 SUPER_ADMIN 세션에 한해 테스트용 날짜/시간 override를 허용하고
// 있으므로, 그 판단 기준과 UI 노출 조건을 동일하게 맞추기 위한 용도다. 쿠키가 httpOnly라
// 클라이언트에서 직접 읽을 방법이 없어 서버에 물어보는 것 외엔 방법이 없다.
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const checkIsSuperAdmin = async (): Promise<boolean> => {
  const response = await fetch(`${BASE_URL}/api/me`, { credentials: "include" });
  if (!response.ok) return false; // 비로그인/다른 권한이면 401 — 정상 상태이니 조용히 false

  const data = (await response.json()) as { role?: string };
  return data.role === "SUPER_ADMIN";
};

export const superAdminSessionKeys = {
  all: ["super-admin-session"] as const,
};

export const isSuperAdminQueryOptions = queryOptions({
  queryKey: superAdminSessionKeys.all,
  queryFn: checkIsSuperAdmin,
  retry: false,
});
