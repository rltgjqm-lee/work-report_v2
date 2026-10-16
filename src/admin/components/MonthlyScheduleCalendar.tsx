import { Fragment } from "react";

import type { LeaveType } from "../types/participants";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const DAYS_PER_WEEK = 7;

const LEAVE_TAG: Record<LeaveType, { label: string; className: string }> = {
  PAID: { label: "유급", className: "bg-admin-status-ok-bg text-admin-status-ok-text" },
  UNPAID: { label: "무급", className: "bg-admin-status-warn-bg text-admin-status-warn-text" },
};

interface MonthlyScheduleCalendarProps {
  yearMonth: string; // "YYYY-MM"
  selectedDates: string[]; // ["YYYY-MM-DD", ...]
  onToggleDate: (date: string) => void;
  minDate?: string; // "YYYY-MM-DD" — 사업단 시작일. 이 날짜 이전은 선택 자체를 막는다.
  maxDate?: string; // "YYYY-MM-DD" — 사업단 종료일. 이 날짜 이후는 선택 자체를 막는다.
  // 조 기본 근무시간이 아닌 다른 시간에 근무하는 날 — 점 하나로만 표시한다. 달력 칸이
  // 작아 시간을 다 못 적으니, 어느 날이 다른지만 여기서 보이고 실제 시간은 아래 목록에서 본다.
  customShiftDates?: string[];
  // 주 단위 일괄 선택 — 둘 다 넘기면 달력 왼쪽에 주마다 체크박스가 하나씩 붙는다.
  // 그 주에 실제로 있는 날짜(그 달, 사업단 기간 안)를 그대로 넘겨줄 뿐, 무엇을 선택으로
  // 칠지는 부모가 정한다 — 달력은 주를 묶는 일만 안다.
  isWeekChecked?: (weekDates: string[]) => boolean;
  onToggleWeek?: (weekDates: string[]) => void;
  // 날짜별 휴무 — 근무일 표시(채운 칸)와 별개로 칸 아래에 유급/무급 꼬리표를 붙인다.
  // 유급 휴무는 근무일에 연차를 쓰는 것이라 근무일과 겹쳐서 보여야 한다. 넘기면 꼬리표
  // 자리를 위해 칸이 조금 높아진다.
  leaveTypeByDate?: Record<string, LeaveType>;
}

/**
 * 월간 근무일 캘린더 — 날짜를 클릭해 근무일/휴무일을 토글한다. 휴무(유급/무급)를 넘기면
 * 근무일 위에 꼬리표로 겹쳐 그린다.
 * 조 기본 스케줄과 참여자 개인 예외 스케줄 설정 모달에서 공통으로 쓴다.
 */
const MonthlyScheduleCalendar = ({
  yearMonth,
  selectedDates,
  onToggleDate,
  minDate,
  maxDate,
  customShiftDates,
  isWeekChecked,
  onToggleWeek,
  leaveTypeByDate,
}: MonthlyScheduleCalendarProps) => {
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const selectedDateSet = new Set(selectedDates);
  const customShiftDateSet = new Set(customShiftDates);
  const hasWeekSelection = !!isWeekChecked && !!onToggleWeek;
  const showsLeaves = !!leaveTypeByDate;

  const dateStringOf = (day: number) => `${yearMonth}-${String(day).padStart(2, "0")}`;
  const isOutsideProgram = (dateString: string) =>
    (!!minDate && dateString < minDate) || (!!maxDate && dateString > maxDate);

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const weeks = Array.from({ length: Math.ceil(cells.length / DAYS_PER_WEEK) }, (_, weekIndex) =>
    cells.slice(weekIndex * DAYS_PER_WEEK, (weekIndex + 1) * DAYS_PER_WEEK),
  );

  const renderDayCell = (day: number | null, key: string) => {
    if (day === null) return <div key={key} />;

    const dateString = dateStringOf(day);
    const isSelected = selectedDateSet.has(dateString);
    const isDisabled = isOutsideProgram(dateString);
    const hasCustomShift = isSelected && customShiftDateSet.has(dateString);
    const leaveType = leaveTypeByDate?.[dateString];

    return (
      <button
        key={dateString}
        type="button"
        disabled={isDisabled}
        onClick={() => onToggleDate(dateString)}
        className={`relative rounded-[6px] text-[12px] border transition-colors ${
          showsLeaves ? "h-11 flex flex-col items-center justify-start pt-1 gap-0.5" : "h-8"
        } ${
          isDisabled
            ? "bg-surface-page text-admin-text-disabled border-border-faint cursor-not-allowed"
            : isSelected
              ? "bg-brand text-white border-brand font-semibold"
              : "bg-white text-admin-text-secondary border-admin-border-subtle hover:bg-admin-selected-tint"
        }`}
      >
        {day}
        {leaveType && (
          <span
            className={`px-1 rounded-[2px] text-[9.5px] font-bold leading-[14px] ${LEAVE_TAG[leaveType].className}`}
          >
            {LEAVE_TAG[leaveType].label}
          </span>
        )}
        {hasCustomShift && (
          <span
            className={`absolute h-1 w-1 rounded-full bg-white ${
              showsLeaves ? "top-1 right-1" : "bottom-1 left-1/2 -translate-x-1/2"
            }`}
          />
        )}
      </button>
    );
  };

  return (
    <div
      className={`grid gap-1.5 ${
        hasWeekSelection ? "grid-cols-[auto_repeat(7,minmax(0,1fr))]" : "grid-cols-7"
      }`}
    >
      {hasWeekSelection && <div />}
      {WEEKDAY_LABELS.map((weekdayLabel) => (
        <div
          key={weekdayLabel}
          className="text-center text-[11px] font-semibold text-admin-text-placeholder py-1"
        >
          {weekdayLabel}
        </div>
      ))}

      {weeks.map((week, weekIndex) => {
        const weekDates = week
          .filter((day): day is number => day !== null)
          .map(dateStringOf)
          .filter((dateString) => !isOutsideProgram(dateString));
        // 근무일이 하나도 없는 주는 시간을 바꿀 대상이 없어서 체크할 것도 없다.
        const hasSelectableDate = weekDates.some((dateString) => selectedDateSet.has(dateString));

        return (
          <Fragment key={`week-${weekIndex}`}>
            {hasWeekSelection && (
              <div className="flex items-center justify-center pr-1">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-brand disabled:opacity-30"
                  disabled={!hasSelectableDate}
                  checked={hasSelectableDate && isWeekChecked(weekDates)}
                  onChange={() => onToggleWeek(weekDates)}
                  aria-label={`${weekIndex + 1}주차 근무일 전체 선택`}
                />
              </div>
            )}
            {week.map((day, dayIndex) => renderDayCell(day, `cell-${weekIndex}-${dayIndex}`))}
          </Fragment>
        );
      })}
    </div>
  );
};

export default MonthlyScheduleCalendar;
