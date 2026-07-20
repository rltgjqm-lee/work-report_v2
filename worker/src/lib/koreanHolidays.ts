// 대한민국 법정공휴일(대체공휴일 포함) — 재난문자 폴링을 주말/공휴일에 건너뛰기 위한 용도.
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

// date: "YYYY-MM-DD" (KST 기준)
export const isWeekendOrHoliday = (date: string): boolean => {
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  const year = date.slice(0, 4);
  return (KOREAN_HOLIDAYS[year] ?? []).includes(date);
};
