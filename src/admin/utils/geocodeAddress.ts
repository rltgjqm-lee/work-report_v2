import { request } from "../api/client";

/**
 * 주소 문자열을 위경도로 바꿉니다. 찾지 못하면 null을 돌려줍니다.
 *
 */
// 실제 조회는 서버(GET /api/demand-sites/geocode)가 juso.go.kr(행정안전부 주소정보지원서비스)에
// 대신 물어본다 — CORS 헤더를 안 내려줘서 브라우저에서 직접 부르면 막힌다.
export const geocodeAddress = async (
  address: string,
): Promise<{ lat: number; lng: number } | null> => {
  if (!address) return null;

  // 못 찾으면 서버가 404 + 한글 메시지를 주고 request가 그대로 던진다 — 부르는 쪽에서
  // 알림으로 띄우거나(거점 편집) 조용히 넘긴다(지도 자동 이동).
  return request<{ lat: number; lng: number }>(
    `/api/demand-sites/geocode?address=${encodeURIComponent(address)}`,
  );
};
