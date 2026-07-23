import { useEffect, useState } from "react";

import {
  getGroupMonthlySchedule,
  updateGroupMonthlySchedule,
} from "../../api/admin/monthlySchedule";
import SlideModal from "../../components/SlideModal";
import FormField from "../../components/FormField";
import MonthlyScheduleCalendar from "../../components/MonthlyScheduleCalendar";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { Group } from "../../types";

const getCurrentYearMonth = () => new Date().toISOString().slice(0, 7);

const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

interface GroupMonthlyScheduleModalProps {
  onClose: () => void;
  onSaved: () => void;
  group: Group;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 조의 월간 근무일 스케줄을 설정하는 모달입니다.
 * 조 전체에 적용되는 기본값이며, 참여자 개인 예외는 별도 모달에서 설정한다.
 */
const GroupMonthlyScheduleModal = ({
  onClose,
  onSaved,
  group,
}: GroupMonthlyScheduleModalProps) => {
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth);
  const [workDates, setWorkDates] = useState<string[]>([]);
  const [maxMonthlyHours, setMaxMonthlyHours] = useState("30");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getGroupMonthlySchedule(group.id, yearMonth)
      .then((schedule) => {
        setWorkDates(schedule.workDates);
        setMaxMonthlyHours(String(schedule.maxMonthlyMinutes / 60));
      })
      .catch(() => {
        setWorkDates([]);
        setMaxMonthlyHours("30");
      })
      .finally(() => setLoading(false));
  }, [group.id, yearMonth]);

  // 조 근무시간(shiftStart~shiftEnd) 기준 하루 근무분 — 근무일 수와 곱해서 월 상한 초과를 미리 막는다
  const shiftMinutesPerDay = Math.max(
    0,
    toMinutes(group.shiftEnd) - toMinutes(group.shiftStart),
  );
  const maxMonthlyMinutes = Math.round(Number(maxMonthlyHours) * 60) || 0;
  const projectedMinutes = workDates.length * shiftMinutesPerDay;
  const isOverCap =
    maxMonthlyMinutes > 0 && projectedMinutes > maxMonthlyMinutes;

  const handleToggleDate = (date: string) => {
    const isAdding = !workDates.includes(date);
    if (isAdding && shiftMinutesPerDay > 0 && maxMonthlyMinutes > 0) {
      const nextMinutes = (workDates.length + 1) * shiftMinutesPerDay;
      if (nextMinutes > maxMonthlyMinutes) {
        const maxDays = Math.floor(maxMonthlyMinutes / shiftMinutesPerDay);
        alert(
          `월 근무시간 상한(${maxMonthlyHours}시간)을 초과합니다. 하루 ${(
            shiftMinutesPerDay / 60
          ).toFixed(1)}시간 기준으로 최대 ${maxDays}일까지 선택할 수 있어요.`,
        );
        return;
      }
    }

    setWorkDates((current) =>
      current.includes(date)
        ? current.filter((workDate) => workDate !== date)
        : [...current, date].sort(),
    );
  };

  const handleSaveButtonClick = async () => {
    if (isOverCap) {
      alert("선택된 근무일이 월 근무시간 상한을 초과합니다. 근무일을 줄이거나 상한을 늘려주세요.");
      return;
    }
    try {
      await updateGroupMonthlySchedule(group.id, {
        yearMonth,
        workDates,
        maxMonthlyMinutes: Math.round(Number(maxMonthlyHours) * 60),
      });
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title={`${group.name} — 월간 근무 스케줄`}
      onClose={onClose}
      footer={
        <>
          <button className={btnGhostClass} onClick={onClose}>
            취소
          </button>
          <button className={btnPrimaryClass} onClick={handleSaveButtonClick}>
            저장
          </button>
        </>
      }
    >
      <FormField label="월">
        <input
          type="month"
          className={inputClass}
          value={yearMonth}
          onChange={(event) => setYearMonth(event.target.value)}
        />
      </FormField>

      <FormField label="월 근무시간 상한(시간)">
        <input
          type="number"
          min={0}
          className={inputClass}
          value={maxMonthlyHours}
          onChange={(event) => setMaxMonthlyHours(event.target.value)}
        />
      </FormField>

      <FormField label="근무일 (클릭해서 선택/해제)">
        {loading ? (
          <div className="text-[13px] text-[#9aa1ab] py-4 text-center">
            불러오는 중...
          </div>
        ) : (
          <MonthlyScheduleCalendar
            yearMonth={yearMonth}
            selectedDates={workDates}
            onToggleDate={handleToggleDate}
          />
        )}
      </FormField>

      <div
        className={`text-[12px] ${isOverCap ? "text-[#e94b4b] font-semibold" : "text-[#9aa1ab]"}`}
      >
        선택된 근무일: {workDates.length}일 · 예상 근무시간:{" "}
        {(projectedMinutes / 60).toFixed(1)}시간 / 상한 {maxMonthlyHours}시간
        {isOverCap && " (상한 초과)"}
      </div>
    </SlideModal>
  );
};

export default GroupMonthlyScheduleModal;
