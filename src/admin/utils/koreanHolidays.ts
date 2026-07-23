// 대한민국 법정공휴일(대체공휴일 포함) — 월간 스케줄 패턴 자동생성 시 주말/공휴일을
// 항상 휴무로 처리하는 용도. worker/src/lib/koreanHolidays.ts와 같은 목록을 프론트에도
// 둔 것 — 관리자 콘솔과 Worker가 별도 빌드라 공유 import가 안 돼서 그대로 복제.
// ⚠️ 하드코딩이라 매년 연말에 다음 해 목록을 추가해야 한다.
const KOREAN_HOLIDAYS: Record<string, string[]> = {
  "2026": [
    "2026-08-15", // 광복절
    "2026-08-17", // 광복절 대체공휴일
    "2026-09-24", // 추석 연휴
    "2026-09-25", // 추석
    "2026-09-26", // 추석 연휴
    "2026-10-03", // 개천절
    "2026-10-05", // 개천절 대체공휴일
    "2026-10-09", // 한글날
    "2026-12-25", // 크리스마스
  ],
};

// date: "YYYY-MM-DD"
export const isWeekendOrHoliday = (date: string): boolean => {
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  const year = date.slice(0, 4);
  return (KOREAN_HOLIDAYS[year] ?? []).includes(date);
};
