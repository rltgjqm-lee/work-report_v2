import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createGroupMutationOptions } from "../../api/admin/groups";
import { updateGroupMonthlyScheduleMutationOptions } from "../../api/admin/monthlySchedule";
import { generateWorkPattern } from "../../utils/generateWorkPattern";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import MonthlyScheduleCalendar from "../../components/MonthlyScheduleCalendar";
import { useToast } from "../../context/useToast";
import { btnGhostClass, btnPrimaryClass, compactInputClass, inputClass } from "../../uiClasses";
import { getLocalYearMonth } from "../../../utils/timeFormat";

const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

const emptyForm = {
  name: "",
  description: "",
  shiftStart: "",
  shiftEnd: "",
};

interface GroupAddModalProps {
  onClose: () => void;
  programId: number;
  programEndDate: string;
  programStartTime: string;
  programEndTime: string;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 조를 추가하는 모달입니다.
 * 월간 근무 근무일도 같이 지정할 수 있고(선택), 근무일을 하나도 안 고르면
 * 근무일 없이 조만 만들어져서 나중에 "수정"으로 따로 설정해도 된다.
 */
const GroupAddModal = ({
  onClose,
  programId,
  programEndDate,
  programStartTime,
  programEndTime,
}: GroupAddModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const [yearMonth, setYearMonth] = useState(getLocalYearMonth);
  const [workDates, setWorkDates] = useState<string[]>([]);
  const [maxMonthlyHours, setMaxMonthlyHours] = useState("30");
  const [patternWorkDays, setPatternWorkDays] = useState("1");
  const [patternRestDays, setPatternRestDays] = useState("2");

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const createGroupMutation = useMutation(createGroupMutationOptions(queryClient));
  const updateGroupMonthlyScheduleMutation = useMutation(
    updateGroupMonthlyScheduleMutationOptions(queryClient),
  );

  const shiftMinutesPerDay =
    form.shiftStart && form.shiftEnd
      ? Math.max(0, toMinutes(form.shiftEnd) - toMinutes(form.shiftStart))
      : 0;
  const maxMonthlyMinutes = Math.round(Number(maxMonthlyHours) * 60) || 0;
  const projectedMinutes = workDates.length * shiftMinutesPerDay;
  const isOverCap = maxMonthlyMinutes > 0 && projectedMinutes > maxMonthlyMinutes;

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

  const handleGeneratePatternButtonClick = () => {
    const workDays = Number(patternWorkDays);
    const restDays = Number(patternRestDays);
    if (!workDays || workDays < 1 || restDays < 0) {
      alert("근무일/휴무일을 올바르게 입력해주세요.");

      return;
    }
    // 💡 자동 생성은 그 달 전체를 기준으로 만들어지니, 사업단 종료일 이후 날짜는
    // 걸러낸다 — 종료일 이후 근무일이 그대로 잡히면 이미 끝난 사업에 근무일이 남는다.
    const generated = generateWorkPattern(yearMonth, workDays, restDays);
    setWorkDates(generated.filter((date) => date <= programEndDate));
  };

  const handleSaveButtonClick = () => {
    if (!form.name || !form.shiftStart || !form.shiftEnd) {
      alert("조 이름과 근무시간을 입력해주세요.");
      return;
    }
    if (form.shiftStart < programStartTime || form.shiftEnd > programEndTime) {
      alert(`근무시간은 사업단 운영시간(${programStartTime}~${programEndTime}) 안에서 설정해주세요.`);
      return;
    }
    if (isOverCap) {
      alert("선택된 근무일이 월 근무시간 상한을 초과합니다. 근무일을 줄이거나 상한을 늘려주세요.");
      return;
    }

    createGroupMutation.mutate(
      { programId, data: form },
      {
        onSuccess: (created) => {
          // 근무일을 하나도 안 골랐으면 월간 근무일 없이 조만 만들고 끝낸다 — 나중에
          // "수정"으로 따로 설정해도 된다.
          if (workDates.length === 0) {
            showToast(`'${form.name}' 조를 추가했습니다.`);
            onClose();
            return;
          }

          updateGroupMonthlyScheduleMutation.mutate(
            {
              groupId: created.id,
              yearMonth,
              workDates,
              maxMonthlyMinutes: Math.round(Number(maxMonthlyHours) * 60),
            },
            {
              onSuccess: () => {
                showToast(`'${form.name}' 조를 추가했습니다.`);
                onClose();
              },
              onError: (error) =>
                alert(
                  error instanceof Error
                    ? `조는 등록됐지만 월간 근무일 저장에 실패했습니다: ${error.message}`
                    : "조는 등록됐지만 월간 근무일 저장에 실패했습니다.",
                ),
            },
          );
        },
        onError: (error) =>
          alert(error instanceof Error ? error.message : "조 등록에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title="조 추가"
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
      <FormField label="조 이름">
        <input
          className={inputClass}
          value={form.name}
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
        />
      </FormField>
      <FormField label="설명">
        <input
          className={inputClass}
          value={form.description}
          onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="근무 시작시간">
            <input
              type="time"
              step={600}
              min={programStartTime}
              max={programEndTime}
              className={inputClass}
              value={form.shiftStart}
              onChange={(event) => setForm((f) => ({ ...f, shiftStart: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="근무 종료시간">
            <input
              type="time"
              step={600}
              min={programStartTime}
              max={programEndTime}
              className={inputClass}
              value={form.shiftEnd}
              onChange={(event) => setForm((f) => ({ ...f, shiftEnd: event.target.value }))}
            />
          </FormField>
        </div>
      </div>
      <div className="text-[12px] text-admin-text-placeholder -mt-2">
        사업단 운영시간({programStartTime}~{programEndTime}) 안에서 설정해주세요
      </div>

      <div className="border-t border-border-faint pt-4 flex flex-col gap-4">
        <div className="text-[13px] font-bold text-text-strong">
          월간 근무일 (선택 — 지금 안 정해도 나중에 수정할 수 있어요)
        </div>

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

        <FormField label="패턴 자동생성 (예: 1근무 2휴무)">
          <div className="flex items-center gap-2 flex-nowrap">
            <input
              type="number"
              min={1}
              className={compactInputClass}
              value={patternWorkDays}
              onChange={(event) => setPatternWorkDays(event.target.value)}
            />
            <span className="text-[13px] text-text-subtle whitespace-nowrap">일 근무 /</span>
            <input
              type="number"
              min={0}
              className={compactInputClass}
              value={patternRestDays}
              onChange={(event) => setPatternRestDays(event.target.value)}
            />
            <span className="text-[13px] text-text-subtle whitespace-nowrap">일 휴무</span>
            <button className={btnGhostClass} onClick={handleGeneratePatternButtonClick}>
              자동 생성
            </button>
          </div>
        </FormField>

        <FormField label="근무일 (클릭해서 선택/해제)">
          <MonthlyScheduleCalendar
            yearMonth={yearMonth}
            selectedDates={workDates}
            onToggleDate={handleToggleDate}
            maxDate={programEndDate}
          />
        </FormField>

        <div
          className={`text-[12px] ${isOverCap ? "text-danger font-semibold" : "text-admin-text-placeholder"}`}
        >
          선택된 근무일: {workDates.length}일 · 예상 근무시간: {(projectedMinutes / 60).toFixed(1)}
          시간 / 상한 {maxMonthlyHours}시간
          {isOverCap && " (상한 초과)"}
          {" · "}사업단 종료일({programEndDate}) 이후는 선택할 수 없어요
        </div>
      </div>
    </SlideModal>
  );
};

export default GroupAddModal;
