import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { updateParticipantMutationOptions } from "../../api/admin/participants";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { ParticipantDetail } from "../../types";

const FEE_TYPE_OPTIONS = [
  { value: "add", label: "가산" },
  { value: "deduct", label: "차감" },
  { value: "none", label: "없음" },
];

interface ParticipantPayrollSettingsModalProps {
  onClose: () => void;
  participant: ParticipantDetail;
}

/**
 * 관리자 페이지 > 참여자 상세 페이지에서 참여자별 급여 관련 설정(교육비/치매검진비/
 * 4대보험/주휴수당)을 편집하는 모달입니다. 4대보험·주휴수당은 역량 활동에만 노출됩니다.
 *
 */
const ParticipantPayrollSettingsModal = ({
  onClose,
  participant,
}: ParticipantPayrollSettingsModalProps) => {
  const queryClient = useQueryClient();
  const updateParticipantMutation = useMutation(updateParticipantMutationOptions(queryClient));
  const [form, setForm] = useState({
    educationAmount: String(participant.educationAmount),
    educationType: participant.educationType,
    dementiaAmount: String(participant.dementiaAmount),
    dementiaType: participant.dementiaType,
    socialInsuranceEnrolled: participant.socialInsuranceEnrolled,
    weeklyHolidayHours: String(participant.weeklyHolidayHours),
  });

  const isCompetencyProgram = participant.programType === "역량 활동";

  const handleSaveButtonClick = () => {
    updateParticipantMutation.mutate(
      {
        id: participant.id,
        data: {
          educationAmount: Number(form.educationAmount),
          educationType: form.educationType,
          dementiaAmount: Number(form.dementiaAmount),
          dementiaType: form.dementiaType,
          ...(isCompetencyProgram
            ? {
                socialInsuranceEnrolled: form.socialInsuranceEnrolled,
                weeklyHolidayHours: Number(form.weeklyHolidayHours),
              }
            : {}),
        },
      },
      {
        onSuccess: () => onClose(),
        onError: (error) => alert(error instanceof Error ? error.message : "저장에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title="급여 관련 설정"
      onClose={onClose}
      footer={
        <>
          <button className={btnGhostClass} onClick={onClose}>
            취소
          </button>
          <button
            className={btnPrimaryClass}
            disabled={updateParticipantMutation.isPending}
            onClick={handleSaveButtonClick}
          >
            {updateParticipantMutation.isPending ? "저장 중..." : "저장"}
          </button>
        </>
      }
    >
      <p className="text-xs text-[#9aa1ab] m-0">
        교육비·치매검진비·4대보험·주휴수당의 지급 여부를 관리합니다.
      </p>

      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="교육비(원)">
            <input
              type="number"
              className={inputClass}
              value={form.educationAmount}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  educationAmount: event.target.value,
                }))
              }
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="교육비 처리">
            <FilterSelect
              className="w-full"
              value={form.educationType}
              onChange={(value) =>
                setForm((f) => ({
                  ...f,
                  educationType: value as "add" | "deduct" | "none",
                }))
              }
              options={FEE_TYPE_OPTIONS}
            />
          </FormField>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="치매 검진비(원)">
            <input
              type="number"
              className={inputClass}
              value={form.dementiaAmount}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  dementiaAmount: event.target.value,
                }))
              }
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="치매검진비 처리">
            <FilterSelect
              className="w-full"
              value={form.dementiaType}
              onChange={(value) =>
                setForm((f) => ({
                  ...f,
                  dementiaType: value as "add" | "deduct" | "none",
                }))
              }
              options={FEE_TYPE_OPTIONS}
            />
          </FormField>
        </div>
      </div>

      {isCompetencyProgram && (
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <FormField label="주휴시간(월, 시간)">
              <input
                type="number"
                className={inputClass}
                value={form.weeklyHolidayHours}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    weeklyHolidayHours: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>
          <div className="flex-1 pb-2.5">
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={form.socialInsuranceEnrolled}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    socialInsuranceEnrolled: event.target.checked,
                  }))
                }
              />
              4대보험 가입
            </label>
          </div>
        </div>
      )}
    </SlideModal>
  );
};

export default ParticipantPayrollSettingsModal;
