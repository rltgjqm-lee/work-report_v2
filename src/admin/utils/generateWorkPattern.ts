import { isWeekendOrHoliday } from "./koreanHolidays";

// "N일 근무 / M일 휴무" 패턴을 그 달 1일부터 반복 적용해 근무일 목록을 만든다.
// 주말/공휴일은 항상 휴무로 취급하고 사이클 카운트에서도 제외한다(어르신 일자리는
// 보통 주말·공휴일에 안 나온다는 전제) — 그래서 근무일은 항상 평일 중에서만 배정된다.
// 예: workDays=1, restDays=2 → 평일 1,4,7,10...일 순으로 (주말/공휴일 사이는 건너뜀)
export const generateWorkPattern = (
  yearMonth: string,
  workDays: number,
  restDays: number,
): string[] => {
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cycleLength = workDays + restDays;
  if (cycleLength <= 0) return [];

  const dates: string[] = [];
  let cyclePosition = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${yearMonth}-${String(day).padStart(2, "0")}`;
    if (isWeekendOrHoliday(dateString)) continue;

    if (cyclePosition < workDays) {
      dates.push(dateString);
    }
    cyclePosition = (cyclePosition + 1) % cycleLength;
  }
  return dates;
};
