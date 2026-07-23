const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

interface MonthlyScheduleCalendarProps {
  yearMonth: string; // "YYYY-MM"
  selectedDates: string[]; // ["YYYY-MM-DD", ...]
  onToggleDate: (date: string) => void;
}

/**
 * 월간 근무일 캘린더 — 날짜를 클릭해 근무일/휴무일을 토글한다.
 * 조 기본 스케줄과 참여자 개인 예외 스케줄 설정 모달에서 공통으로 쓴다.
 */
const MonthlyScheduleCalendar = ({
  yearMonth,
  selectedDates,
  onToggleDate,
}: MonthlyScheduleCalendarProps) => {
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const selectedDateSet = new Set(selectedDates);

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAY_LABELS.map((weekdayLabel) => (
        <div
          key={weekdayLabel}
          className="text-center text-[11px] font-semibold text-[#9aa1ab] py-1"
        >
          {weekdayLabel}
        </div>
      ))}
      {cells.map((day, index) => {
        if (day === null) return <div key={`empty-${index}`} />;
        const dateString = `${yearMonth}-${String(day).padStart(2, "0")}`;
        const isSelected = selectedDateSet.has(dateString);
        return (
          <button
            key={dateString}
            type="button"
            onClick={() => onToggleDate(dateString)}
            className={`h-8 rounded-[6px] text-[12px] border transition-colors ${
              isSelected
                ? "bg-[#3182f6] text-white border-[#3182f6] font-semibold"
                : "bg-white text-[#374151] border-[#e2e5eb] hover:bg-[#f5f8fb]"
            }`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
};

export default MonthlyScheduleCalendar;
