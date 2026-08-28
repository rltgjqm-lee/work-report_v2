import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkRegisterParticipantLeaveMutationOptions } from "../../api/admin/participants";
import { useToast } from "../../context/useToast";
import type { LeaveType } from "../../types/participants";

import Button from "../../components/Button";
import FilterSelect from "../../components/FilterSelect";
import FormField from "../../components/FormField";
import Input from "../../components/Input";
import SlideModal from "../../components/modal/SlideModal";

const emptyForm = {
  leaveStart: "",
  leaveEnd: "",
  leaveType: "PAID" as LeaveType,
  reason: "",
};

const LEAVE_TYPE_OPTIONS = [
  { value: "PAID", label: "유급(연차 차감)" },
  { value: "UNPAID", label: "무급" },
];

interface BulkLeaveModalProps {
  onClose: () => void;
  onSaved: () => void;
  programId: number;
  targets: { id: number; name: string }[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 선택한 참여자 여러 명에게 한 번에
 * 휴무를 등록하는 모달입니다.
 *
 */
const BulkLeaveModal = ({ onClose, onSaved, programId, targets }: BulkLeaveModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const bulkRegisterParticipantLeaveMutation = useMutation(
    bulkRegisterParticipantLeaveMutationOptions(queryClient),
  );

  const handleSaveButtonClick = () => {
    if (!form.leaveStart || !form.leaveEnd) {
      alert("휴무 시작일과 종료일을 입력해주세요.");

      return;
    }
    bulkRegisterParticipantLeaveMutation.mutate(
      {
        programId,
        participantIds: targets.map((target) => target.id),
        leaveStart: form.leaveStart,
        leaveEnd: form.leaveEnd,
        leaveType: form.leaveType,
        reason: form.reason || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.skipped.length === 0) {
            showToast(`${result.updated.length}명의 휴무를 등록했습니다.`);
          } else {
            const skippedNames = result.skipped
              .map((skip) => `${skip.name}(${skip.reason})`)
              .join(", ");
            alert(
              `${result.updated.length}명 등록 완료, ${result.skipped.length}명 제외됨: ${skippedNames}`,
            );
          }
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
      title={`선택한 ${targets.length}명 일괄 휴무 등록`}
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
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="시작일">
            <Input
              type="date"
              value={form.leaveStart}
              onChange={(event) => setForm((form) => ({ ...form, leaveStart: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="종료일">
            <Input
              type="date"
              value={form.leaveEnd}
              onChange={(event) => setForm((form) => ({ ...form, leaveEnd: event.target.value }))}
            />
          </FormField>
        </div>
      </div>
      <FormField label="휴가 유형">
        <FilterSelect
          className="w-full"
          value={form.leaveType}
          onChange={(value) => setForm((form) => ({ ...form, leaveType: value as LeaveType }))}
          options={LEAVE_TYPE_OPTIONS}
        />
      </FormField>
      <FormField label="사유">
        <Input
          value={form.reason}
          onChange={(event) => setForm((form) => ({ ...form, reason: event.target.value }))}
        />
      </FormField>
    </SlideModal>
  );
};

export default BulkLeaveModal;
