import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkSetAnnualLeaveMutationOptions } from "../../api/admin/participants";
import { useToast } from "../../context/useToast";

import Button from "../../components/Button";
import FormField from "../../components/FormField";
import Input from "../../components/Input";
import SlideModal from "../../components/modal/SlideModal";

const currentYear = new Date().getFullYear().toString();

const emptyForm = {
  year: currentYear,
  totalDays: "",
};

interface BulkAnnualLeaveModalProps {
  onClose: () => void;
  onSaved: () => void;
  programId: number;
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
  targets,
}: BulkAnnualLeaveModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const bulkSetAnnualLeaveMutation = useMutation(bulkSetAnnualLeaveMutationOptions(queryClient));

  const handleSaveButtonClick = () => {
    if (!form.totalDays) {
      alert("총 연차 일수를 입력해주세요.");

      return;
    }
    bulkSetAnnualLeaveMutation.mutate(
      {
        programId,
        participantIds: targets.map((target) => target.id),
        year: form.year,
        totalDays: Number(form.totalDays),
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
      <FormField label="총 연차 일수">
        <Input
          type="number"
          value={form.totalDays}
          onChange={(event) => setForm((form) => ({ ...form, totalDays: event.target.value }))}
        />
      </FormField>
    </SlideModal>
  );
};

export default BulkAnnualLeaveModal;
