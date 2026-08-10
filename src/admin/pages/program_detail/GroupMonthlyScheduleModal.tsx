import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  groupMonthlyScheduleQueryOptions,
  updateGroupMonthlyScheduleMutationOptions,
} from "../../api/admin/monthlySchedule";
import { updateGroupMutationOptions } from "../../api/admin/groups";
import { generateWorkPattern } from "../../utils/generateWorkPattern";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import MonthlyScheduleCalendar from "../../components/MonthlyScheduleCalendar";
import { useToast } from "../../context/useToast";
import Button from "../../components/Button";
import Input from "../../components/Input";
import { getLocalYearMonth } from "../../../utils/timeFormat";
import type { Group } from "../../types";

const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

interface GroupMonthlyScheduleModalProps {
  onClose: () => void;
  group: Group;
  programEndDate: string;
  programStartTime: string;
  programEndTime: string;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 조 기본 정보와 월간 근무일을 함께 수정하는 모달입니다.
 * 조 전체에 적용되는 기본값이며, 참여자 개인 예외는 별도 모달에서 설정합니다.
 */
const GroupMonthlyScheduleModal = ({
  onClose,
  group,
  programEndDate,
  programStartTime,
  programEndTime,
}: GroupMonthlyScheduleModalProps) => {
  const [form, setForm] = useState({
    name: group.name,
    description: group.description ?? "",
    shiftStart: group.shiftStart,
    shiftEnd: group.shiftEnd,
  });
  const [yearMonth, setYearMonth] = useState(getLocalYearMonth);
  const [workDates, setWorkDates] = useState<string[]>([]);
  const [maxMonthlyHours, setMaxMonthlyHours] = useState("30");
  const [patternWorkDays, setPatternWorkDays] = useState("1");
  const [patternRestDays, setPatternRestDays] = useState("2");
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const {
    data: schedule,
    isFetching,
    isError,
  } = useQuery(groupMonthlyScheduleQueryOptions(group.id, yearMonth));

  useEffect(() => {
    if (schedule) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 조회된 초기값을 편집 가능한 로컬 상태로 동기화
      setWorkDates(schedule.workDates);
      setMaxMonthlyHours(String(schedule.maxMonthlyMinutes / 60));
    } else if (isError) {
      setWorkDates([]);
      setMaxMonthlyHours("30");
    }
  }, [schedule, isError]);

  const updateGroupMutation = useMutation(updateGroupMutationOptions(queryClient));
  const updateGroupMonthlyScheduleMutation = useMutation(
    updateGroupMonthlyScheduleMutationOptions(queryClient),
  );

  // 근무 시작/종료시간은 이제 이 모달에서 바로 고칠 수 있어서, group prop이 아니라
  // 지금 입력 중인 값(form) 기준으로 하루 근무분을 계산해야 상한 검증이 어긋나지 않는다.
  const shiftMinutesPerDay = Math.max(0, toMinutes(form.shiftEnd) - toMinutes(form.shiftStart));
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

    updateGroupMutation.mutate(
      { id: group.id, programId: group.programId, data: form },
      {
        onSuccess: () => {
          if (workDates.length === 0) {
            showToast("조 정보를 수정했습니다.");
            onClose();
            return;
          }

          updateGroupMonthlyScheduleMutation.mutate(
            {
              groupId: group.id,
              yearMonth,
              workDates,
              maxMonthlyMinutes: Math.round(Number(maxMonthlyHours) * 60),
            },
            {
              onSuccess: () => {
                showToast("조 정보와 월간 근무일을 수정했습니다.");
                onClose();
              },
              onError: (error) =>
                alert(
                  error instanceof Error
                    ? `조 정보는 수정됐지만 월간 근무일 저장에 실패했습니다: ${error.message}`
                    : "조 정보는 수정됐지만 월간 근무일 저장에 실패했습니다.",
                ),
            },
          );
        },
        onError: (error) =>
          alert(error instanceof Error ? error.message : "조 정보 수정에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title={`${group.name} — 조 수정`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSaveButtonClick}>
            저장
          </Button>
        </>
      }
    >
      <FormField label="조 이름">
        <Input
          value={form.name}
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
        />
      </FormField>
      <FormField label="설명">
        <Input
          value={form.description}
          onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="근무 시작시간">
            <Input
              type="time"
              step={600}
              min={programStartTime}
              max={programEndTime}
              value={form.shiftStart}
              onChange={(event) => setForm((f) => ({ ...f, shiftStart: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="근무 종료시간">
            <Input
              type="time"
              step={600}
              min={programStartTime}
              max={programEndTime}
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
          월간 근무일 (선택 — 지금 안 바꿔도 나중에 다시 이 모달로 수정할 수 있어요)
        </div>

        <FormField label="월">
          <Input
            type="month"
            value={yearMonth}
            onChange={(event) => setYearMonth(event.target.value)}
          />
        </FormField>

        <FormField label="월 근무시간 상한(시간)">
          <Input
            type="number"
            min={0}
            value={maxMonthlyHours}
            onChange={(event) => setMaxMonthlyHours(event.target.value)}
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

        <FormField label="근무일 (클릭해서 선택/해제)">
          {isFetching ? (
            <div className="text-[13px] text-admin-text-placeholder py-4 text-center">불러오는 중...</div>
          ) : (
            <MonthlyScheduleCalendar
              yearMonth={yearMonth}
              selectedDates={workDates}
              onToggleDate={handleToggleDate}
              maxDate={programEndDate}
            />
          )}
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

export default GroupMonthlyScheduleModal;
