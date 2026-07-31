import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { registerParticipantLeaveMutationOptions } from "../../api/admin/participants";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { LeaveType } from "../../types";

const emptyForm = {
  leaveStart: "",
  leaveEnd: "",
  leaveType: "PAID" as LeaveType,
  reason: "",
};

interface ParticipantLeaveAddModalProps {
  onClose: () => void;
  programId: number;
  target: { id: number; name: string } | null;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 참여자 휴무를 등록하는 모달입니다.
 *
 */
const ParticipantLeaveAddModal = ({
  onClose,
  programId,
  target,
}: ParticipantLeaveAddModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const registerParticipantLeaveMutation = useMutation(
    registerParticipantLeaveMutationOptions(queryClient),
  );

  const handleSaveButtonClick = () => {
    if (!target) return;
    if (!form.leaveStart || !form.leaveEnd) {
      alert("휴무 시작일과 종료일을 입력해주세요.");

      return;
    }
    registerParticipantLeaveMutation.mutate(
      {
        participantId: target.id,
        programId,
        leaveStart: form.leaveStart,
        leaveEnd: form.leaveEnd,
        leaveType: form.leaveType,
        reason: form.reason || undefined,
      },
      {
        onSuccess: () => onClose(),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title={target ? `'${target.name}' 님 휴무 등록` : "휴무 등록"}
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
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="시작일">
            <input
              type="date"
              className={inputClass}
              value={form.leaveStart}
              onChange={(event) => setForm((f) => ({ ...f, leaveStart: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="종료일">
            <input
              type="date"
              className={inputClass}
              value={form.leaveEnd}
              onChange={(event) => setForm((f) => ({ ...f, leaveEnd: event.target.value }))}
            />
          </FormField>
        </div>
      </div>
      <FormField label="휴가 유형">
        <FilterSelect
          className="w-full"
          value={form.leaveType}
          onChange={(value) => setForm((f) => ({ ...f, leaveType: value as LeaveType }))}
          options={[
            { value: "PAID", label: "유급(연차 차감)" },
            { value: "UNPAID", label: "무급" },
          ]}
        />
      </FormField>
      <FormField label="사유">
        <input
          className={inputClass}
          value={form.reason}
          onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
        />
      </FormField>
    </SlideModal>
  );
};

export default ParticipantLeaveAddModal;
