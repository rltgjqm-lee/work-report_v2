import { useEffect, useState } from "react";

// 서버(/api/mobile)는 시각을 진짜 UTC ISO로 주므로 new Date()로 읽어 폰 시간대(KST)로 보여준다.

const MINUTE_MS = 60 * 1000;

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const pad = (value: number) => String(value).padStart(2, "0");

// "10:43" / "어제 15:11" / "8/21 13:24"
export const formatClock = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (isSameDay(date, now)) return clock;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `어제 ${clock}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${clock}`;
};

// "3분" / "1시간 5분" / "2일"
export const formatDuration = (ms: number) => {
  const minutes = Math.max(0, Math.floor(ms / MINUTE_MS));
  if (minutes < 1) return "1분 미만";
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? `${hours}시간` : `${hours}시간 ${minutes % 60}분`;
  return `${Math.floor(hours / 24)}일`;
};

export const formatElapsedSince = (iso: string, now = new Date()) =>
  formatDuration(now.getTime() - new Date(iso).getTime());

export const formatMeters = (meters: number) => `${meters.toLocaleString("ko-KR")}m`;

// 홈 상단 "2026년 11월 14일"
export const formatToday = (now = new Date()) =>
  `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;

// 관제구역 기준 위치 — "평내고에서 320m" / "평내고 관제 구역 안"
export const describeZonePosition = (demandSiteName: string | null, outsideM: number | null) => {
  const site = demandSiteName ?? "배정 수요처";
  if (outsideM === null) return "관제 구역과 비교할 수 없어요";
  if (outsideM === 0) return `${site} 관제 구역 안`;
  return `${site}에서 ${formatMeters(outsideM)} 벗어남`;
};

export const zoneBadgeText = (outsideM: number | null) => {
  if (outsideM === null) return "위치 모름";
  if (outsideM === 0) return "구역 안";
  return `구역 밖 ${formatMeters(outsideM)}`;
};

// 경과 시간 표시를 30초마다 다시 그린다
export const useNow = (intervalMs = 30 * 1000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "총괄 관리자",
  ORGANIZATION_ADMIN: "기관 관리자",
  SUB_ADMIN: "부관리자",
  MANAGER: "사업 담당",
};
