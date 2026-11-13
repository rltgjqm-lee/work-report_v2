import { isWeekendOrHoliday } from "./koreanHolidays";

const pad = (value: number): string => String(value).padStart(2, "0");

const eachDateInRange = (fromDate: string, toDate: string): string[] => {
  const [year, month, day] = fromDate.split("-").map(Number);
  const cursor = new Date(year, month - 1, day);
  const dates: string[] = [];

  for (;;) {
    const dateString = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    if (dateString > toDate) break;
    dates.push(dateString);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

// "N일 근무 / M일 휴무" 패턴을 fromDate부터 toDate까지 끊김 없이 반복 적용한다.
// 주말/공휴일은 항상 휴무로 취급하고 사이클 카운트에서도 제외한다(참여자는
// 보통 주말·공휴일에 안 나온다는 전제) — 그래서 근무일은 항상 평일 중에서만 배정된다.
//
// 사이클을 달마다 리셋하지 않는 게 핵심이다 — 사업단 기간 전체를 한 번에 편성할 때
// 월 경계에서 사이클이 끊기면 "1근무 2휴무"가 달이 바뀔 때마다 어긋난다.
export const generateWorkPatternInRange = (
  fromDate: string,
  toDate: string,
  workDays: number,
  restDays: number,
): string[] => {
  const cycleLength = workDays + restDays;
  if (cycleLength <= 0) return [];

  const dates: string[] = [];
  let cyclePosition = 0;
  for (const dateString of eachDateInRange(fromDate, toDate)) {
    if (isWeekendOrHoliday(dateString)) continue;

    if (cyclePosition < workDays) {
      dates.push(dateString);
    }
    cyclePosition = (cyclePosition + 1) % cycleLength;
  }

  return dates;
};

// 한 달치만 생성하는 형태 — 참여자 개인 예외 스케줄처럼 월 단위로만 편성하는 곳에서 쓴다.
export const generateWorkPattern = (
  yearMonth: string,
  workDays: number,
  restDays: number,
): string[] => {
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  return generateWorkPatternInRange(
    `${yearMonth}-01`,
    `${yearMonth}-${pad(daysInMonth)}`,
    workDays,
    restDays,
  );
};
