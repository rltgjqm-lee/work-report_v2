import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getLocalYearMonth } from "../../../utils/timeFormat";
import { createGroupMutationOptions } from "../../api/admin/groups";
import { updateGroupScheduleMutationOptions } from "../../api/admin/monthlySchedule";
import { useToast } from "../../context/useToast";
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

const emptyForm = {
  name: "",
  description: "",
  shiftStart: "",
  shiftEnd: "",
};

interface GroupAddModalProps {
  onClose: () => void;
  programId: number;
  programStartDate: string;
  programEndDate: string;
  programStartTime: string;
  programEndTime: string;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 조를 추가하는 모달입니다.
 * 월간 근무일을 하나도 안 고르면 저장할 수 없다 — 근무일이 없으면 참여자가
 * 근무일 여부와 무관하게 아무 날에나 출근 처리될 수 있어서, 조를 만드는
 * 시점에 최소 하루 이상의 근무일을 반드시 같이 등록하게 한다.
 *
 * 저장 범위는 사업단 기간 전체다 — 조를 만드는 시점에 기간 전체 편성을 깔아둬서,
 * 달이 바뀔 때마다 편성을 다시 잡으러 들어오지 않아도 되게 한다. 만든 뒤의 수정은
 * 조 수정 모달에서 한다.
 */
const GroupAddModal = ({
  onClose,
  programId,
  programStartDate,
  programEndDate,
  programStartTime,
  programEndTime,
}: GroupAddModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const [yearMonth, setYearMonth] = useState(() =>
    clampYearMonth(getLocalYearMonth(), programStartDate, programEndDate),
  );
  const [workDates, setWorkDates] = useState<string[]>([]);
  const [shiftByDate, setShiftByDate] = useState<ShiftByDate>({});
  const [maxMonthlyHours, setMaxMonthlyHours] = useState("30");

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const createGroupMutation = useMutation(createGroupMutationOptions(queryClient));
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
    if (workDates.length === 0) {
      alert("월간 근무일을 하나 이상 선택해야 합니다.");
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

    createGroupMutation.mutate(
      { programId, data: form },
      {
        onSuccess: (created) => {
          updateGroupScheduleMutation.mutate(
            {
              groupId: created.id,
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
                showToast(`'${form.name}' 조를 추가했습니다.`);
                onClose();
              },
              onError: (error) =>
                alert(
                  error instanceof Error
                    ? `조는 등록됐지만 근무일 저장에 실패했습니다: ${error.message}`
                    : "조는 등록됐지만 근무일 저장에 실패했습니다.",
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
      />
    </SlideModal>
  );
};

export default GroupAddModal;
