import { useState } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { useToast } from "../context/useToast";

import type { LeaveType } from "../types/participants";
import { generateWorkPatternInRange } from "../utils/generateWorkPattern";
import {
  minutesByMonth,
  minutesOfShift,
  monthsBetween,
  shiftOfDate,
  type Shift,
  type ShiftByDate,
} from "../utils/groupShift";
import SubTabBar from "./bar/SubTabBar";
import Button from "./Button";
import FormField from "./FormField";
import Input from "./Input";
import MonthlyScheduleCalendar from "./MonthlyScheduleCalendar";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 달력 클릭이 무엇을 켜고 끌지 — 근무일과 휴무는 독립이라 같은 날짜에 둘 다 있을 수 있다.
type CalendarMode = "WORK" | LeaveType;

const CALENDAR_MODE_TABS: [CalendarMode, string][] = [
  ["WORK", "근무일"],
  ["UNPAID", "무급 휴무"],
  ["PAID", "유급 휴무"],
];

const CALENDAR_MODE_LABEL: Record<CalendarMode, string> = {
  WORK: "근무일",
  UNPAID: "무급 휴무",
  PAID: "유급 휴무",
};

const monthNavButtonClass = (isEnabled: boolean): string =>
  `flex items-center justify-center h-7 w-7 rounded-[2px] border ${
    isEnabled
      ? "bg-white text-admin-text-secondary border-admin-border-subtle hover:bg-admin-selected-tint"
      : "bg-surface-page text-admin-text-disabled border-border-faint cursor-not-allowed"
  }`;

const weekdayLabelOf = (date: string): string => {
  const [year, month, day] = date.split("-").map(Number);

  return WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
};

interface GroupScheduleFieldsProps {
  yearMonth: string;
  onYearMonthChange: (yearMonth: string) => void;
  workDates: string[];
  onWorkDatesChange: (workDates: string[]) => void;
  shiftByDate: ShiftByDate;
  onShiftByDateChange: (shiftByDate: ShiftByDate) => void;
  maxMonthlyHours: string;
  onMaxMonthlyHoursChange: (maxMonthlyHours: string) => void;
  // 조 기본 근무시간 — 저장된 값이 아니라 지금 모달에서 입력 중인 값을 받는다. 상한
  // 계산과 "기본값과 다른 날" 판단이 편집 중인 값을 따라가야 검증이 어긋나지 않는다.
  defaultShift: Shift;
  programStartDate: string;
  programEndDate: string;
  programStartTime: string;
  programEndTime: string;
  isLoading?: boolean;
  note?: string;
  // 조 일괄 휴무 — 넘기면 달력 위에 근무일/무급/유급 필터가 생긴다. 조를 아직 만들기 전인
  // 조 추가 모달은 휴무를 걸 조원이 없어서 넘기지 않는다.
  leaveTypeByDate?: Record<string, LeaveType>;
  onLeaveTypeByDateChange?: (leaveTypeByDate: Record<string, LeaveType>) => void;
}

/**
 * 조의 월간 근무일과 날짜별 근무시간을 함께 편집하는 섹션입니다.
 * 조 추가 모달과 조 수정 모달이 같은 편성을 다뤄서 공통으로 씁니다.
 *
 * 근무일마다 근무시간을 다르게 줄 수 있습니다 — "이번주는 오전, 다음주는 오후"처럼
 * 같은 조가 주/달마다 다른 시간에 근무하는 편성을 조를 새로 만들거나 참여자를 옮기지
 * 않고 표현하기 위함입니다. 교대 주기를 저장하지 않으므로 불규칙한 편성도 그대로
 * 들어갑니다. 실제 저장 대상은 기본 근무시간과 다른 날뿐입니다(toShiftOverrides).
 */
const GroupScheduleFields = ({
  yearMonth,
  onYearMonthChange,
  workDates,
  onWorkDatesChange,
  shiftByDate,
  onShiftByDateChange,
  maxMonthlyHours,
  onMaxMonthlyHoursChange,
  defaultShift,
  programStartDate,
  programEndDate,
  programStartTime,
  programEndTime,
  isLoading,
  note,
  leaveTypeByDate,
  onLeaveTypeByDateChange,
}: GroupScheduleFieldsProps) => {
  const [patternWorkDays, setPatternWorkDays] = useState("1");
  const [patternRestDays, setPatternRestDays] = useState("2");
  // 달력의 주 체크박스로 고른 날짜들 — 시간을 한 번에 바꿀 대상이다. 근무일만 담긴다.
  const [bulkSelectedDates, setBulkSelectedDates] = useState<string[]>([]);
  const [bulkShiftStart, setBulkShiftStart] = useState("");
  const [bulkShiftEnd, setBulkShiftEnd] = useState("");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("WORK");
  const { showToast } = useToast();
  const showsLeaves = !!leaveTypeByDate && !!onLeaveTypeByDateChange;
  const leaveDates = Object.keys(leaveTypeByDate ?? {});
  const countLeaves = (leaveType: LeaveType, month?: string) =>
    leaveDates.filter(
      (leaveDate) =>
        leaveTypeByDate?.[leaveDate] === leaveType && (!month || leaveDate.startsWith(month)),
    ).length;

  const shiftOf = (date: string) => shiftOfDate(date, shiftByDate, defaultShift);
  const maxMonthlyMinutes = Math.round(Number(maxMonthlyHours) * 60) || 0;

  // workDates/shiftByDate는 사업단 기간 전체를 담고 있다 — 날짜가 절대값("YYYY-MM-DD")이라
  // 달마다 쪼개 들고 있을 필요가 없고, 달력·목록은 보고 있는 달의 몫만 걸러 쓰면 된다.
  const programMonths = monthsBetween(programStartDate, programEndDate);
  const monthMinutes = minutesByMonth(workDates, shiftByDate, defaultShift);
  const totalMinutes = Object.values(monthMinutes).reduce((sum, minutes) => sum + minutes, 0);

  const sortedWorkDates = workDates.filter((workDate) => workDate.startsWith(yearMonth)).sort();
  const customShiftDates = sortedWorkDates.filter((workDate) => !!shiftByDate[workDate]);

  // 달 이동은 programMonths 안에서 인덱스로 옮긴다 — 날짜 연산으로 직접 ±1개월 하면
  // 사업단 기간 밖으로 나갈 수 있어서, 목록의 양끝이 그대로 이동 한계가 되게 한다.
  const monthIndex = programMonths.indexOf(yearMonth);

  // 달을 옮기면 선택을 비운다 — 안 보이는 달의 날짜가 선택에 남아 "선택한 N일"만
  // 늘어나면 뭘 고치는 건지 알 수 없다.
  const goToMonth = (targetMonth: string) => {
    setBulkSelectedDates([]);
    onYearMonthChange(targetMonth);
  };

  const previousMonth = monthIndex > 0 ? programMonths[monthIndex - 1] : undefined;
  const nextMonth =
    monthIndex >= 0 && monthIndex < programMonths.length - 1
      ? programMonths[monthIndex + 1]
      : undefined;

  // 주 체크박스는 "그 주의 근무일 전부"를 켜고 끈다 — 근무일이 아닌 날은 시간을 줘도
  // 안 쓰이므로(근무일 여부가 먼저 판정된다) 애초에 선택 대상에서 뺀다.
  const workDatesOfWeek = (weekDates: string[]) =>
    weekDates.filter((weekDate) => workDates.includes(weekDate));

  const isWeekChecked = (weekDates: string[]) => {
    const weekWorkDates = workDatesOfWeek(weekDates);

    return (
      weekWorkDates.length > 0 &&
      weekWorkDates.every((weekWorkDate) => bulkSelectedDates.includes(weekWorkDate))
    );
  };

  const handleWeekToggle = (weekDates: string[]) => {
    const weekWorkDates = workDatesOfWeek(weekDates);
    if (weekWorkDates.length === 0) return;

    setBulkSelectedDates((current) =>
      isWeekChecked(weekDates)
        ? current.filter((selectedDate) => !weekWorkDates.includes(selectedDate))
        : [...new Set([...current, ...weekWorkDates])].sort(),
    );
  };

  const handleWorkDateToggle = (date: string) => {
    if (workDates.includes(date)) {
      onWorkDatesChange(workDates.filter((workDate) => workDate !== date));
      // 근무일에서 뺀 날은 일괄수정 대상에서도 빠져야 "선택한 N일"이 실제와 맞는다.
      setBulkSelectedDates((current) => current.filter((selectedDate) => selectedDate !== date));

      return;
    }

    // 상한은 달마다 따로 걸린다 — 기간 전체 합이 아니라 그 날이 속한 달의 합으로 본다.
    const addedMinutes = minutesOfShift(shiftOf(date));
    const monthSoFar = monthMinutes[date.slice(0, 7)] ?? 0;
    if (maxMonthlyMinutes > 0 && monthSoFar + addedMinutes > maxMonthlyMinutes) {
      alert(
        `${date.slice(0, 7)}의 월 근무시간 상한(${maxMonthlyHours}시간)을 초과합니다. ` +
          `그 달에 이미 ${(monthSoFar / 60).toFixed(1)}시간이라 이 날(${(addedMinutes / 60).toFixed(
            1,
          )}시간)은 더 넣을 수 없습니다.`,
      );

      return;
    }

    onWorkDatesChange([...workDates, date].sort());
  };

  // 휴무는 근무일이 아니어도 찍을 수 있다(근무일 여부와 독립). 같은 날 유급과 무급이
  // 동시에 있을 수는 없어서, 다른 유형이 이미 있으면 지금 고른 유형으로 바꾼다.
  const handleLeaveDateToggle = (date: string, leaveType: LeaveType) => {
    if (!leaveTypeByDate || !onLeaveTypeByDateChange) return;

    if (leaveTypeByDate[date] === leaveType) {
      onLeaveTypeByDateChange(
        Object.fromEntries(
          Object.entries(leaveTypeByDate).filter(([leaveDate]) => leaveDate !== date),
        ),
      );

      return;
    }

    onLeaveTypeByDateChange({ ...leaveTypeByDate, [date]: leaveType });
  };

  const handleCalendarDateToggle = (date: string) => {
    if (calendarMode === "WORK") {
      handleWorkDateToggle(date);

      return;
    }
    handleLeaveDateToggle(date, calendarMode);
  };

  const handleGeneratePatternButtonClick = () => {
    const workDays = Number(patternWorkDays);
    const restDays = Number(patternRestDays);
    if (!workDays || workDays < 1 || restDays < 0) {
      alert("근무일/휴무일을 올바르게 입력해야 합니다.");

      return;
    }
    // 사업단 시작일~종료일 전체에 끊김 없이 적용한다 — 조를 만드는 시점에 기간 전체
    // 편성을 깔아두기 위함이고, 달마다 사이클이 리셋되면 "1근무 2휴무"가 월 경계에서
    // 어긋나기 때문에 범위 생성 함수를 쓴다.
    if (
      !confirm(
        `사업단 기간(${programStartDate} ~ ${programEndDate}) 전체의 근무일을 다시 만듭니다. 지금 선택된 근무일은 모두 사라집니다. 계속하시겠습니까?`,
      )
    ) {
      return;
    }

    onWorkDatesChange(
      generateWorkPatternInRange(programStartDate, programEndDate, workDays, restDays),
    );
  };

  // "이번주는 오전, 다음주는 오후" 같은 편성을 날짜 하나씩 고치지 않고 한 번에 넣기
  // 위한 것 — 달력에서 주 단위로 고르게 해서, 교대가 주기적이지 않아도 그때그때
  // 필요한 주만 집어 바꿀 수 있다.
  const handleBulkApplyButtonClick = () => {
    if (bulkSelectedDates.length === 0) {
      alert("달력 왼쪽 체크박스로 시간을 바꿀 주를 먼저 선택해야 합니다.");

      return;
    }
    if (!bulkShiftStart || !bulkShiftEnd) {
      alert("적용할 근무시간을 입력해야 합니다.");

      return;
    }
    if (bulkShiftStart >= bulkShiftEnd) {
      alert("근무 종료시간이 시작시간보다 늦어야 합니다.");

      return;
    }
    if (bulkShiftStart < programStartTime || bulkShiftEnd > programEndTime) {
      alert(
        `근무시간은 사업단 운영시간(${programStartTime}~${programEndTime}) 안에서 설정해야 합니다.`,
      );

      return;
    }

    onShiftByDateChange({
      ...shiftByDate,
      ...Object.fromEntries(
        bulkSelectedDates.map((selectedDate) => [
          selectedDate,
          { shiftStart: bulkShiftStart, shiftEnd: bulkShiftEnd },
        ]),
      ),
    });
    showToast(`${bulkSelectedDates.length}일에 ${bulkShiftStart}~${bulkShiftEnd}을 적용했습니다.`);
    setBulkSelectedDates([]);
  };

  const handleDateShiftChange = (date: string, field: keyof Shift, value: string) => {
    onShiftByDateChange({ ...shiftByDate, [date]: { ...shiftOf(date), [field]: value } });
  };

  const handleResetDateShiftButtonClick = (date: string) => {
    onShiftByDateChange(
      Object.fromEntries(Object.entries(shiftByDate).filter(([shiftDate]) => shiftDate !== date)),
    );
  };

  return (
    <>
      <div className="border-t border-border-faint pt-4 flex flex-col gap-4">
        <div className="text-[13px] font-bold text-text-strong">
          월간 근무일 ({programStartDate} ~ {programEndDate})
        </div>
        {note && <div className="text-[12px] text-admin-text-placeholder -mt-2">{note}</div>}

        <FormField label="월별 편성 현황">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-bold tracking-wide text-text-subtle bg-admin-surface-header px-3 py-2 border-b border-admin-border-subtle">
                  월
                </th>
                <th className="text-right text-[11px] font-bold tracking-wide text-text-subtle bg-admin-surface-header px-3 py-2 border-b border-admin-border-subtle">
                  근무일
                </th>
                <th className="text-right text-[11px] font-bold tracking-wide text-text-subtle bg-admin-surface-header px-3 py-2 border-b border-admin-border-subtle">
                  근무시간
                </th>
                {showsLeaves && (
                  <>
                    <th className="text-right text-[11px] font-bold tracking-wide text-text-subtle bg-admin-surface-header px-3 py-2 border-b border-admin-border-subtle">
                      무급
                    </th>
                    <th className="text-right text-[11px] font-bold tracking-wide text-text-subtle bg-admin-surface-header px-3 py-2 border-b border-admin-border-subtle">
                      유급
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {programMonths.map((programMonth) => {
                const monthDays = workDates.filter((workDate) =>
                  workDate.startsWith(programMonth),
                ).length;
                const monthHours = (monthMinutes[programMonth] ?? 0) / 60;
                const isMonthOverCap =
                  maxMonthlyMinutes > 0 && (monthMinutes[programMonth] ?? 0) > maxMonthlyMinutes;
                return (
                  <tr key={programMonth}>
                    <td className="px-3 py-2 text-[13px] border-b border-border-faint whitespace-nowrap tabular-nums">
                      {yearMonth.slice(0, 4) === programMonth.slice(0, 4)
                        ? `${Number(programMonth.slice(5))}월`
                        : `${programMonth.slice(0, 4)}년 ${Number(programMonth.slice(5))}월`}
                    </td>
                    <td
                      className={`px-3 py-2 text-[13px] text-right border-b border-border-faint tabular-nums ${
                        monthDays === 0 ? "text-admin-text-placeholder" : ""
                      }`}
                    >
                      {monthDays === 0 ? "미편성" : `${monthDays}일`}
                    </td>
                    <td
                      className={`px-3 py-2 text-[13px] text-right border-b border-border-faint tabular-nums ${
                        isMonthOverCap
                          ? "text-danger font-semibold"
                          : monthDays === 0
                            ? "text-admin-text-placeholder"
                            : ""
                      }`}
                    >
                      {monthDays === 0 ? "—" : `${monthHours.toFixed(1)}시간`}
                      {isMonthOverCap && " ⚠"}
                    </td>
                    {showsLeaves &&
                      (["UNPAID", "PAID"] as const).map((leaveType) => {
                        const monthLeaveDays = countLeaves(leaveType, programMonth);

                        return (
                          <td
                            key={leaveType}
                            className={`px-3 py-2 text-[13px] text-right border-b border-border-faint tabular-nums ${
                              monthLeaveDays === 0 ? "text-admin-text-placeholder" : ""
                            }`}
                          >
                            {monthLeaveDays === 0 ? "—" : `${monthLeaveDays}일`}
                          </td>
                        );
                      })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-3 py-2 text-[13px] font-bold bg-admin-surface-header border-t border-admin-border-subtle whitespace-nowrap">
                  합계
                </td>
                <td className="px-3 py-2 text-[13px] font-bold text-right bg-admin-surface-header border-t border-admin-border-subtle tabular-nums">
                  {workDates.length}일
                </td>
                {/* 상한은 달마다 걸리는 값이라 합계에는 초과 표시를 하지 않는다 —
                    어느 달이 넘쳤는지는 위 각 행이 이미 빨갛게 알려준다. */}
                <td className="px-3 py-2 text-[13px] font-bold text-right bg-admin-surface-header border-t border-admin-border-subtle tabular-nums">
                  {(totalMinutes / 60).toFixed(1)}시간
                </td>
                {showsLeaves &&
                  (["UNPAID", "PAID"] as const).map((leaveType) => (
                    <td
                      key={leaveType}
                      className="px-3 py-2 text-[13px] font-bold text-right bg-admin-surface-header border-t border-admin-border-subtle tabular-nums"
                    >
                      {countLeaves(leaveType)}일
                    </td>
                  ))}
              </tr>
            </tfoot>
          </table>
        </FormField>

        <FormField label="월 근무시간 상한(시간)">
          <Input
            type="number"
            min={0}
            value={maxMonthlyHours}
            onChange={(event) => onMaxMonthlyHoursChange(event.target.value)}
          />
        </FormField>

        <FormField label="패턴 자동생성 (예: 1근무 2휴무)">
          <div className="flex items-center gap-2 flex-nowrap">
            <Input
              compact
              type="number"
              min={1}
              value={patternWorkDays}
              onChange={(event) => setPatternWorkDays(event.target.value)}
            />
            <span className="text-[13px] text-text-subtle whitespace-nowrap">일 근무 /</span>
            <Input
              compact
              type="number"
              min={0}
              value={patternRestDays}
              onChange={(event) => setPatternRestDays(event.target.value)}
            />
            <span className="text-[13px] text-text-subtle whitespace-nowrap">일 휴무</span>
            <Button variant="ghost" onClick={handleGeneratePatternButtonClick}>
              자동 생성
            </Button>
          </div>
        </FormField>

        <FormField label={`${CALENDAR_MODE_LABEL[calendarMode]} (클릭해서 선택/해제)`}>
          {showsLeaves && (
            <>
              <SubTabBar
                tabs={CALENDAR_MODE_TABS}
                active={calendarMode}
                onChange={setCalendarMode}
              />
              <div className="text-[12px] text-admin-text-placeholder -mt-2 mb-3">
                {calendarMode === "WORK"
                  ? "근무일을 켜고 끕니다. 휴무는 근무일과 따로 표시됩니다."
                  : "조원 전체에게 일괄 적용됩니다. 근무일이 아닌 날이나 지난 날짜도 선택할 수 있고, 근무일은 그대로 유지됩니다."}
                {calendarMode === "PAID" && " 휴무 날짜의 연도 연차에서 차감됩니다."}
              </div>
            </>
          )}
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              type="button"
              disabled={!previousMonth}
              onClick={() => previousMonth && goToMonth(previousMonth)}
              aria-label="이전 달"
              className={monthNavButtonClass(!!previousMonth)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-bold text-text-strong tabular-nums">
              {yearMonth.slice(0, 4)}년 {Number(yearMonth.slice(5))}월
            </span>
            <button
              type="button"
              disabled={!nextMonth}
              onClick={() => nextMonth && goToMonth(nextMonth)}
              aria-label="다음 달"
              className={monthNavButtonClass(!!nextMonth)}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {isLoading ? (
            <div className="text-[13px] text-admin-text-placeholder py-4 text-center">
              불러오는 중...
            </div>
          ) : (
            <MonthlyScheduleCalendar
              yearMonth={yearMonth}
              selectedDates={workDates}
              onToggleDate={handleCalendarDateToggle}
              minDate={programStartDate}
              maxDate={programEndDate}
              customShiftDates={customShiftDates}
              isWeekChecked={isWeekChecked}
              onToggleWeek={handleWeekToggle}
              leaveTypeByDate={showsLeaves ? leaveTypeByDate : undefined}
            />
          )}
          {showsLeaves && (
            <div className="flex items-center gap-3 flex-wrap mt-2 text-[11.5px] text-text-subtle">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-[3px] bg-brand" />
                근무일
              </span>
              <span className="flex items-center gap-1">
                <span className="px-1 rounded-[2px] text-[9.5px] font-bold leading-[14px] bg-admin-status-warn-bg text-admin-status-warn-text">
                  무급
                </span>
                무급 휴무
              </span>
              <span className="flex items-center gap-1">
                <span className="px-1 rounded-[2px] text-[9.5px] font-bold leading-[14px] bg-admin-status-ok-bg text-admin-status-ok-text">
                  유급
                </span>
                유급 휴무
              </span>
            </div>
          )}
        </FormField>
      </div>

      <div className="border-t border-border-faint pt-4 flex flex-col gap-4">
        <div className="text-[13px] font-bold text-text-strong">날짜별 근무시간</div>
        <div className="text-[12px] text-admin-text-placeholder -mt-2">
          기본 근무시간({defaultShift.shiftStart || "미입력"}~{defaultShift.shiftEnd || "미입력"})과
          다른 날만 바꾸면 됩니다.
        </div>

        <FormField label="선택한 주에 한 번에 적용">
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-admin-text-placeholder">
              {bulkSelectedDates.length === 0
                ? "달력 왼쪽 체크박스로 주를 선택하면, 그 주 근무일 전체의 시간을 한 번에 바꿀 수 있습니다."
                : `선택한 ${bulkSelectedDates.length}일에 아래 시간을 적용합니다.`}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                flex
                type="time"
                step={600}
                min={programStartTime}
                max={programEndTime}
                value={bulkShiftStart}
                onChange={(event) => setBulkShiftStart(event.target.value)}
              />
              <span className="shrink-0 text-[13px] text-text-subtle">~</span>
              <Input
                flex
                type="time"
                step={600}
                min={programStartTime}
                max={programEndTime}
                value={bulkShiftEnd}
                onChange={(event) => setBulkShiftEnd(event.target.value)}
              />
              <Button className="shrink-0" variant="ghost" onClick={handleBulkApplyButtonClick}>
                적용
              </Button>
            </div>
          </div>
        </FormField>

        {sortedWorkDates.length === 0 ? (
          <div className="text-[13px] text-admin-text-placeholder py-2">
            먼저 위 달력에서 근무일을 선택해야 합니다.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {sortedWorkDates.map((workDate) => {
              const shift = shiftOf(workDate);
              const isCustom = !!shiftByDate[workDate];

              return (
                <li
                  key={workDate}
                  className="flex items-center gap-2 flex-wrap text-[13px] px-3 py-2 border border-admin-border-subtle rounded-[2px]"
                >
                  <span
                    // 날짜 문자열은 줄마다 길이가 같아서, tabular-nums로 숫자 폭만 고정하면
                    // 폭을 px로 박지 않아도 줄끼리 알아서 정렬된다.
                    className={`shrink-0 whitespace-nowrap tabular-nums ${isCustom ? "font-semibold text-text-strong" : ""}`}
                  >
                    {workDate} ({weekdayLabelOf(workDate)})
                  </span>
                  <Input
                    flex
                    type="time"
                    step={600}
                    min={programStartTime}
                    max={programEndTime}
                    value={shift.shiftStart}
                    onChange={(event) =>
                      handleDateShiftChange(workDate, "shiftStart", event.target.value)
                    }
                  />
                  <span className="shrink-0 text-text-subtle">~</span>
                  <Input
                    flex
                    type="time"
                    step={600}
                    min={programStartTime}
                    max={programEndTime}
                    value={shift.shiftEnd}
                    onChange={(event) =>
                      handleDateShiftChange(workDate, "shiftEnd", event.target.value)
                    }
                  />
                  {isCustom && (
                    <button
                      className="shrink-0 whitespace-nowrap text-[12px] text-text-subtle underline"
                      onClick={() => handleResetDateShiftButtonClick(workDate)}
                    >
                      기본값으로
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
};

export default GroupScheduleFields;
