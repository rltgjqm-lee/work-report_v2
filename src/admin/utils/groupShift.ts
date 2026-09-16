import type { GroupShiftOverride } from "../api/admin/monthlySchedule";

export interface Shift {
  shiftStart: string; // "HH:MM"
  shiftEnd: string;
}

// 조 기본 근무시간과 다른 날의 시간을 "날짜 → 시간"으로 들고 있는다 — 목록·달력·상한
// 계산이 전부 날짜로 조회하는 구조라 배열보다 다루기 쉽고, 저장할 때만 배열로 편다.
export type ShiftByDate = Record<string, Shift>;

const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);

  return hour * 60 + minute;
};

// 조를 만드는 중이라 기본 근무시간이 아직 비어 있을 수 있어서, 빈 값은 0분으로 본다
// (입력 전에 상한 초과 경고가 먼저 뜨지 않게).
export const minutesOfShift = (shift: Shift): number =>
  shift.shiftStart && shift.shiftEnd
    ? Math.max(0, toMinutes(shift.shiftEnd) - toMinutes(shift.shiftStart))
    : 0;

export const shiftOfDate = (date: string, shiftByDate: ShiftByDate, defaultShift: Shift): Shift =>
  shiftByDate[date] ?? defaultShift;

// 그 달 예상 근무시간(분) — 날짜마다 시간이 다를 수 있으니 근무일수 × 하루분이 아니라
// 날짜별 시간의 합으로 계산한다.
export const projectedMonthlyMinutes = (
  workDates: string[],
  shiftByDate: ShiftByDate,
  defaultShift: Shift,
): number =>
  workDates.reduce(
    (sum, workDate) => sum + minutesOfShift(shiftOfDate(workDate, shiftByDate, defaultShift)),
    0,
  );

// 근무시간이 뒤집혔거나 사업단 운영시간을 벗어난 첫 날짜 — 없으면 undefined.
export const findInvalidShiftDate = (
  workDates: string[],
  shiftByDate: ShiftByDate,
  defaultShift: Shift,
  programStartTime: string,
  programEndTime: string,
): string | undefined =>
  [...workDates].sort().find((workDate) => {
    const shift = shiftOfDate(workDate, shiftByDate, defaultShift);

    return (
      shift.shiftStart >= shift.shiftEnd ||
      shift.shiftStart < programStartTime ||
      shift.shiftEnd > programEndTime
    );
  });

// 서버에 보낼 날짜별 근무시간 — 근무일에서 빠진 날은 빼고(서버도 근무일이 아닌 날은
// 거부한다), 기본 근무시간과 같아진 날도 뺀다. 이 테이블에 "기본과 다른 날"만 남겨야
// 나중에 조 기본 근무시간을 바꿨을 때 따로 지정 안 한 날들이 같이 따라 움직인다.
export const toShiftOverrides = (
  workDates: string[],
  shiftByDate: ShiftByDate,
  defaultShift: Shift,
): GroupShiftOverride[] =>
  [...workDates]
    .sort()
    .filter((workDate) => {
      const shift = shiftByDate[workDate];

      return (
        !!shift &&
        (shift.shiftStart !== defaultShift.shiftStart || shift.shiftEnd !== defaultShift.shiftEnd)
      );
    })
    .map((workDate) => ({ date: workDate, ...shiftByDate[workDate] }));

// 사업단 기간이 걸쳐 있는 모든 달 — ["2026-10", "2026-11", ...].
// 근무일이 하나도 없는 달도 포함한다. 저장할 때 그 달을 빈 편성으로 덮어써야
// 관리자가 지운 근무일이 서버에 남지 않는다.
export const monthsBetween = (fromDate: string, toDate: string): string[] => {
  const months: string[] = [];
  const [year, month] = fromDate.split("-").map(Number);
  const cursor = new Date(year, month - 1, 1);
  const lastMonth = toDate.slice(0, 7);

  for (;;) {
    const yearMonth = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    if (yearMonth > lastMonth) break;
    months.push(yearMonth);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

// 달마다 예상 근무시간(분) — 상한(maxMonthlyMinutes)이 월 단위 값이라 검사도 달별로 해야 한다.
export const minutesByMonth = (
  workDates: string[],
  shiftByDate: ShiftByDate,
  defaultShift: Shift,
): Record<string, number> =>
  workDates.reduce<Record<string, number>>((byMonth, workDate) => {
    const yearMonth = workDate.slice(0, 7);
    byMonth[yearMonth] =
      (byMonth[yearMonth] ?? 0) + minutesOfShift(shiftOfDate(workDate, shiftByDate, defaultShift));

    return byMonth;
  }, {});

// 월 상한을 넘긴 달 목록 — 어느 달이 문제인지 짚어줘야 기간 전체 편성에서 원인을 찾을 수 있다.
export const findOverCapMonths = (
  workDates: string[],
  shiftByDate: ShiftByDate,
  defaultShift: Shift,
  maxMonthlyMinutes: number,
): string[] => {
  if (maxMonthlyMinutes <= 0) return [];

  return Object.entries(minutesByMonth(workDates, shiftByDate, defaultShift))
    .filter(([, minutes]) => minutes > maxMonthlyMinutes)
    .map(([yearMonth]) => yearMonth)
    .sort();
};

// 저장 payload — 사업단 기간의 모든 달을 담는다. 근무일이 하나도 없는 달도 빈 배열로
// 넣어야 관리자가 지운 근무일이 서버에 남지 않는다.
export const toMonthlySchedules = (
  programStartDate: string,
  programEndDate: string,
  workDates: string[],
  shiftByDate: ShiftByDate,
  defaultShift: Shift,
  maxMonthlyMinutes: number,
) =>
  monthsBetween(programStartDate, programEndDate).map((yearMonth) => {
    const monthWorkDates = workDates.filter((workDate) => workDate.startsWith(yearMonth)).sort();

    return {
      yearMonth,
      workDates: monthWorkDates,
      maxMonthlyMinutes,
      shiftOverrides: toShiftOverrides(monthWorkDates, shiftByDate, defaultShift),
    };
  });

// 편성 화면을 열었을 때 처음 볼 달 — 오늘이 사업단 기간 안이면 이번 달, 기간이 아직
// 시작 안 했으면 시작 달, 이미 끝났으면 마지막 달. 월 입력이 기간 밖으로 나가 있으면
// 달력에 선택 가능한 날이 하나도 없어서 빈 화면처럼 보인다.
export const clampYearMonth = (
  yearMonth: string,
  programStartDate: string,
  programEndDate: string,
): string => {
  const startMonth = programStartDate.slice(0, 7);
  const endMonth = programEndDate.slice(0, 7);
  if (yearMonth < startMonth) return startMonth;
  if (yearMonth > endMonth) return endMonth;

  return yearMonth;
};
