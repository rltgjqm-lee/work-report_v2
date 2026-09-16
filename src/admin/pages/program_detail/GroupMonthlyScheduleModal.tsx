import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getLocalYearMonth } from "../../../utils/timeFormat";
import { updateGroupMutationOptions } from "../../api/admin/groups";
import {
  groupScheduleQueryOptions,
  updateGroupScheduleMutationOptions,
} from "../../api/admin/monthlySchedule";
import { useToast } from "../../context/useToast";
import type { Group } from "../../types/groups";
import {
  clampYearMonth,
  findInvalidShiftDate,
  findOverCapMonths,
  toMonthlySchedules,
  type ShiftByDate,
} from "../../utils/groupShift";

import Button from "../../components/Button";
import FormField from "../../components/FormField";
import GroupScheduleFields from "../../components/GroupScheduleFields";
import Input from "../../components/Input";
import SlideModal from "../../components/modal/SlideModal";

interface GroupMonthlyScheduleModalProps {
  onClose: () => void;
  group: Group;
  programStartDate: string;
  programEndDate: string;
  programStartTime: string;
  programEndTime: string;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 조 기본 정보와 월간 근무일을 함께 수정하는 모달입니다.
 * 조 전체에 적용되는 기본값이며, 참여자 개인 예외는 별도 모달에서 설정합니다.
 *
 * 편성은 조 추가 시점에 사업단 기간 전체가 깔리므로, 여기서는 그중 고칠 부분만
 * 손보면 됩니다. 사업단 종료일이 나중에 늘어나 새로 생긴 달을 채우는 것도 여기서 합니다.
 */
const GroupMonthlyScheduleModal = ({
  onClose,
  group,
  programStartDate,
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
  const [yearMonth, setYearMonth] = useState(() =>
    clampYearMonth(getLocalYearMonth(), programStartDate, programEndDate),
  );
  const [workDates, setWorkDates] = useState<string[]>([]);
  const [shiftByDate, setShiftByDate] = useState<ShiftByDate>({});
  const [maxMonthlyHours, setMaxMonthlyHours] = useState("30");
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // 달을 넘길 때마다 다시 조회하지 않도록 기간 전체 편성을 한 번에 들고 온다 —
  // 저장도 기간 전체를 통째로 보내므로 화면 상태와 저장 단위가 같아진다.
  const { data: schedule, isFetching, isError } = useQuery(groupScheduleQueryOptions(group.id));

  useEffect(() => {
    if (schedule) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 조회된 초기값을 편집 가능한 로컬 상태로 동기화
      setWorkDates(schedule.months.flatMap((month) => month.workDates));
      setShiftByDate(
        Object.fromEntries(
          schedule.months.flatMap((month) =>
            month.shiftOverrides.map((shiftOverride) => [
              shiftOverride.date,
              { shiftStart: shiftOverride.shiftStart, shiftEnd: shiftOverride.shiftEnd },
            ]),
          ),
        ),
      );
      // 상한은 달마다 저장되지만 화면에서는 하나로 다룬다 — 이미 저장된 값이 있으면
      // 그중 첫 달 값을 초기값으로 쓰고, 저장 시 모든 달에 같은 값이 적용된다.
      const savedMaxMinutes = schedule.months[0]?.maxMonthlyMinutes;
      setMaxMonthlyHours(savedMaxMinutes ? String(savedMaxMinutes / 60) : "30");
    } else if (isError) {
      setWorkDates([]);
      setShiftByDate({});
      setMaxMonthlyHours("30");
    }
  }, [schedule, isError]);

  const updateGroupMutation = useMutation(updateGroupMutationOptions(queryClient));
  const updateGroupScheduleMutation = useMutation(updateGroupScheduleMutationOptions(queryClient));

  const handleSaveButtonClick = () => {
    if (!form.name || !form.shiftStart || !form.shiftEnd) {
      alert("조 이름과 근무시간을 입력해야 합니다.");
      return;
    }
    if (form.shiftStart < programStartTime || form.shiftEnd > programEndTime) {
      alert(
        `근무시간은 사업단 운영시간(${programStartTime}~${programEndTime}) 안에서 설정해야 합니다.`,
      );
      return;
    }

    const maxMonthlyMinutes = Math.round(Number(maxMonthlyHours) * 60);
    const overCapMonths = findOverCapMonths(workDates, shiftByDate, form, maxMonthlyMinutes);
    if (overCapMonths.length > 0) {
      alert(
        `${overCapMonths.join(", ")}의 근무일이 월 근무시간 상한을 초과합니다. 그 달의 근무일을 줄이거나 상한을 늘려야 합니다.`,
      );
      return;
    }

    const invalidDate = findInvalidShiftDate(
      workDates,
      shiftByDate,
      form,
      programStartTime,
      programEndTime,
    );
    if (invalidDate) {
      alert(
        `${invalidDate}의 근무시간이 올바르지 않습니다. 사업단 운영시간(${programStartTime}~${programEndTime}) 안에서, 종료가 시작보다 늦어야 합니다.`,
      );
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

          updateGroupScheduleMutation.mutate(
            {
              groupId: group.id,
              months: toMonthlySchedules(
                programStartDate,
                programEndDate,
                workDates,
                shiftByDate,
                form,
                maxMonthlyMinutes,
              ),
            },
            {
              onSuccess: () => {
                showToast("조 정보와 근무일을 수정했습니다.");
                onClose();
              },
              onError: (error) =>
                alert(
                  error instanceof Error
                    ? `조 정보는 수정됐지만 근무일 저장에 실패했습니다: ${error.message}`
                    : "조 정보는 수정됐지만 근무일 저장에 실패했습니다.",
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
          <Button onClick={handleSaveButtonClick}>저장</Button>
        </>
      }
    >
      <FormField label="조 이름">
        <Input
          value={form.name}
          onChange={(event) => setForm((form) => ({ ...form, name: event.target.value }))}
        />
      </FormField>
      <FormField label="설명">
        <Input
          value={form.description}
          onChange={(event) => setForm((form) => ({ ...form, description: event.target.value }))}
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="기본 근무 시작시간">
            <Input
              type="time"
              step={600}
              min={programStartTime}
              max={programEndTime}
              value={form.shiftStart}
              onChange={(event) => setForm((form) => ({ ...form, shiftStart: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="기본 근무 종료시간">
            <Input
              type="time"
              step={600}
              min={programStartTime}
              max={programEndTime}
              value={form.shiftEnd}
              onChange={(event) => setForm((form) => ({ ...form, shiftEnd: event.target.value }))}
            />
          </FormField>
        </div>
      </div>
      <div className="text-[12px] text-admin-text-placeholder -mt-2">
        사업단 운영시간({programStartTime}~{programEndTime}) 안에서 설정해야 합니다. 날짜마다 다르게
        근무한다면 아래 &lsquo;날짜별 근무시간&rsquo;에서 그 날만 바꿉니다.
      </div>

      <GroupScheduleFields
        yearMonth={yearMonth}
        onYearMonthChange={setYearMonth}
        workDates={workDates}
        onWorkDatesChange={setWorkDates}
        shiftByDate={shiftByDate}
        onShiftByDateChange={setShiftByDate}
        maxMonthlyHours={maxMonthlyHours}
        onMaxMonthlyHoursChange={setMaxMonthlyHours}
        defaultShift={form}
        programStartDate={programStartDate}
        programEndDate={programEndDate}
        programStartTime={programStartTime}
        programEndTime={programEndTime}
        isLoading={isFetching}
        note="사업단 기간 전체의 편성입니다. 달력 위 좌우 버튼으로 달을 옮겨가며 고칠 수 있습니다."
      />
    </SlideModal>
  );
};

export default GroupMonthlyScheduleModal;
