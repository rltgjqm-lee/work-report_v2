import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  participantAnnualLeaveQueryOptions,
  setAnnualLeaveMutationOptions,
} from "../../api/admin/participants";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import { useToast } from "../../context/useToast";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";

const currentYear = new Date().getFullYear().toString();

const emptyForm = {
  year: currentYear,
  totalDays: "",
};

interface AnnualLeaveModalProps {
  onClose: () => void;
  target: { id: number; name: string } | null;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 참여자 연차를 설정하는 모달입니다.
 *
 */
const AnnualLeaveModal = ({ onClose, target }: AnnualLeaveModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: balance } = useQuery({
    ...participantAnnualLeaveQueryOptions(target?.id ?? 0, currentYear),
    enabled: !!target,
  });
  const setAnnualLeaveMutation = useMutation(setAnnualLeaveMutationOptions(queryClient));

  const handleSaveButtonClick = () => {
    if (!target) return;
    if (!form.totalDays) {
      alert("총 연차 일수를 입력해주세요.");

      return;
    }
    setAnnualLeaveMutation.mutate(
      { participantId: target.id, year: form.year, totalDays: Number(form.totalDays) },
      {
        onSuccess: () => showToast("연차를 저장했습니다."),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title={target ? `'${target.name}' 님 연차` : "연차"}
      onClose={onClose}
      footer={
        <>
          <button className={btnGhostClass} onClick={onClose}>
            닫기
          </button>
          <button className={btnPrimaryClass} onClick={handleSaveButtonClick}>
            저장
          </button>
        </>
      }
    >
      {balance && (
        <div className="text-xs text-text-subtle mb-3">
          {balance.year}년 현황 — 총 {balance.totalDays}일 / 사용 {balance.usedDays}일 / 잔여{" "}
          {balance.remainingDays}일
        </div>
      )}
      <FormField label="연도">
        <input
          className={inputClass}
          value={form.year}
          onChange={(event) => setForm((f) => ({ ...f, year: event.target.value }))}
        />
      </FormField>
      <FormField label="총 연차 일수">
        <input
          type="number"
          className={inputClass}
          value={form.totalDays}
          onChange={(event) => setForm((f) => ({ ...f, totalDays: event.target.value }))}
        />
      </FormField>
    </SlideModal>
  );
};

export default AnnualLeaveModal;
