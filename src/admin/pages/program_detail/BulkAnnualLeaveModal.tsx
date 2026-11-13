import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkSetAnnualLeaveMutationOptions } from "@work-report/admin-core/api/participants";

import { useToast } from "../../context/useToast";

import Button from "../../components/Button";
import FormField from "../../components/FormField";
import Input from "../../components/Input";
import SlideModal from "../../components/modal/SlideModal";

const currentYear = new Date().getFullYear().toString();

const emptyForm = {
  year: currentYear,
  totalDays: "",
  // 역량활용 전용 — 시스템 도입 전(출퇴근 기록이 없는 달)에 만근해서 생긴 연차 일수
  preSystemAccruedDays: "",
};

interface BulkAnnualLeaveModalProps {
  onClose: () => void;
  onSaved: () => void;
  programId: number;
  // 역량활용은 총 일수 대신 도입 전 만근 일수를 넣는다(총 일수는 만근한 달 수로 계산)
  isCapacityProgram: boolean;
  targets: { id: number; name: string }[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 선택한 참여자 여러 명의 연차를
 * 한 번에 설정하는 모달입니다.
 *
 */
const BulkAnnualLeaveModal = ({
  onClose,
  onSaved,
  programId,
  isCapacityProgram,
  targets,
}: BulkAnnualLeaveModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const bulkSetAnnualLeaveMutation = useMutation(bulkSetAnnualLeaveMutationOptions(queryClient));

  const handleSaveButtonClick = () => {
    const value = isCapacityProgram ? form.preSystemAccruedDays : form.totalDays;
    if (!value) {
      alert(
        isCapacityProgram ? "도입 전 만근 일수를 입력해주세요." : "총 연차 일수를 입력해주세요.",
      );

      return;
    }
    bulkSetAnnualLeaveMutation.mutate(
      {
        programId,
        participantIds: targets.map((target) => target.id),
        year: form.year,
        ...(isCapacityProgram
          ? { preSystemAccruedDays: Number(value) }
          : { totalDays: Number(value) }),
      },
      {
        onSuccess: () => {
          showToast(`${targets.length}명의 연차를 저장했습니다.`);
          onSaved();
          onClose();
        },
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title={`선택한 ${targets.length}명 일괄 연차 설정`}
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
      <div className="text-[12.5px] text-text-subtle mb-1">
        {targets.map((target) => target.name).join(", ")}
      </div>
      <FormField label="연도">
        <Input
          value={form.year}
          onChange={(event) => setForm((form) => ({ ...form, year: event.target.value }))}
        />
      </FormField>
      {isCapacityProgram ? (
        <>
          <div className="text-[12.5px] text-text-subtle mb-2">
            총 연차는 시스템 기록으로 센 만근 달 수에 이 일수를 더해 계산됩니다(최대 10일). 시스템을
            쓰기 전 기간에 만근한 달 수를 넣어주세요.
          </div>
          <FormField label="도입 전 만근 일수(0~10)">
            <Input
              type="number"
              min={0}
              max={10}
              value={form.preSystemAccruedDays}
              onChange={(event) =>
                setForm((form) => ({ ...form, preSystemAccruedDays: event.target.value }))
              }
            />
          </FormField>
        </>
      ) : (
        <FormField label="총 연차 일수">
          <Input
            type="number"
            value={form.totalDays}
            onChange={(event) => setForm((form) => ({ ...form, totalDays: event.target.value }))}
          />
        </FormField>
      )}
    </SlideModal>
  );
};

export default BulkAnnualLeaveModal;
