import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateParticipantMutationOptions } from "@work-report/admin-core/api/participants";
import type { ParticipantDetail } from "@work-report/admin-core/types/participants";

import { useToast } from "../../context/useToast";

import Button from "../../components/Button";
import FilterSelect from "../../components/FilterSelect";
import FormField from "../../components/FormField";
import Input from "../../components/Input";
import SlideModal from "../../components/modal/SlideModal";

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
 * 4대보험/입사일)을 편집하는 모달입니다. 4대보험·입사일은 역량 활용에만 노출됩니다.
 * 주휴시간은 월 인정 근로시간 구간으로 급여대장에서 자동 계산하므로 여기서 받지 않습니다.
 *
 */
const ParticipantPayrollSettingsModal = ({
  onClose,
  participant,
}: ParticipantPayrollSettingsModalProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const updateParticipantMutation = useMutation(updateParticipantMutationOptions(queryClient));
  const [form, setForm] = useState({
    hourlyWage: String(participant.hourlyWage ?? participant.programHourlyWage),
    educationAmount: String(participant.educationAmount),
    educationType: participant.educationType,
    dementiaAmount: String(participant.dementiaAmount),
    dementiaType: participant.dementiaType,
    healthInsuranceEnrolled: participant.healthInsuranceEnrolled,
    longtermCareInsuranceEnrolled: participant.longtermCareInsuranceEnrolled,
    employmentInsuranceEnrolled: participant.employmentInsuranceEnrolled,
    industrialAccidentInsuranceEnrolled: participant.industrialAccidentInsuranceEnrolled,
    hireDate: participant.hireDate ?? "",
  });

  const isCompetencyProgram = participant.programType === "역량 활용";

  const handleSaveButtonClick = () => {
    updateParticipantMutation.mutate(
      {
        id: participant.id,
        data: {
          hourlyWage: Number(form.hourlyWage),
          educationAmount: Number(form.educationAmount),
          educationType: form.educationType,
          dementiaAmount: Number(form.dementiaAmount),
          dementiaType: form.dementiaType,
          ...(isCompetencyProgram
            ? {
                healthInsuranceEnrolled: form.healthInsuranceEnrolled,
                longtermCareInsuranceEnrolled: form.longtermCareInsuranceEnrolled,
                employmentInsuranceEnrolled: form.employmentInsuranceEnrolled,
                industrialAccidentInsuranceEnrolled: form.industrialAccidentInsuranceEnrolled,
                hireDate: form.hireDate || null,
              }
            : {}),
        },
      },
      {
        onSuccess: () => {
          showToast("급여 관련 설정을 저장했습니다.");
          onClose();
        },
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
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button disabled={updateParticipantMutation.isPending} onClick={handleSaveButtonClick}>
            {updateParticipantMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </>
      }
    >
      <p className="text-xs text-admin-text-placeholder m-0">
        시급·교육비·치매검진비·4대보험 가입 여부와 입사일을 관리합니다.
      </p>

      <FormField label="시급(원)">
        <Input
          type="number"
          value={form.hourlyWage}
          onChange={(event) => setForm((form) => ({ ...form, hourlyWage: event.target.value }))}
        />
        <p className="text-[11.5px] text-admin-text-placeholder mt-1.5">
          기본값은 사업단 등록 시 설정한 시급({participant.programHourlyWage.toLocaleString()}원)
          입니다.
        </p>
      </FormField>

      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="교육비(원)">
            <Input
              type="number"
              value={form.educationAmount}
              onChange={(event) =>
                setForm((form) => ({
                  ...form,
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
                setForm((form) => ({
                  ...form,
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
            <Input
              type="number"
              value={form.dementiaAmount}
              onChange={(event) =>
                setForm((form) => ({
                  ...form,
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
                setForm((form) => ({
                  ...form,
                  dementiaType: value as "add" | "deduct" | "none",
                }))
              }
              options={FEE_TYPE_OPTIONS}
            />
          </FormField>
        </div>
      </div>

      {isCompetencyProgram && (
        <>
          <FormField label="입사일">
            <Input
              type="date"
              value={form.hireDate}
              onChange={(event) =>
                setForm((form) => ({
                  ...form,
                  hireDate: event.target.value,
                }))
              }
            />
            <p className="text-[11.5px] text-admin-text-placeholder mt-1.5">
              평일 공휴일 유급(1일 3시간)은 입사일 이후 공휴일에만 줍니다. 비워두면 사업단 시작일(
              {participant.programStartDate})부터 재직으로 봅니다.
            </p>
          </FormField>

          <FormField label="4대보험 가입">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.healthInsuranceEnrolled}
                  onChange={(event) =>
                    setForm((form) => ({
                      ...form,
                      healthInsuranceEnrolled: event.target.checked,
                    }))
                  }
                />
                건강보험
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.longtermCareInsuranceEnrolled}
                  onChange={(event) =>
                    setForm((form) => ({
                      ...form,
                      longtermCareInsuranceEnrolled: event.target.checked,
                    }))
                  }
                />
                장기요양보험
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.employmentInsuranceEnrolled}
                  onChange={(event) =>
                    setForm((form) => ({
                      ...form,
                      employmentInsuranceEnrolled: event.target.checked,
                    }))
                  }
                />
                고용보험
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.industrialAccidentInsuranceEnrolled}
                  onChange={(event) =>
                    setForm((form) => ({
                      ...form,
                      industrialAccidentInsuranceEnrolled: event.target.checked,
                    }))
                  }
                />
                산재보험
              </label>
            </div>
          </FormField>
        </>
      )}
    </SlideModal>
  );
};

export default ParticipantPayrollSettingsModal;
