import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  participantAnnualLeaveQueryOptions,
  registerParticipantLeaveMutationOptions,
} from "@work-report/admin-core/api/participants";
import type { LeaveType } from "@work-report/admin-core/types/participants";

import { useToast } from "../../context/useToast";

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

const toLeaveDays = (leaveStart: string, leaveEnd: string) =>
  Math.floor(
    (new Date(`${leaveEnd}T00:00:00Z`).getTime() - new Date(`${leaveStart}T00:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24),
  ) + 1;

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
  const { showToast } = useToast();
  const registerParticipantLeaveMutation = useMutation(
    registerParticipantLeaveMutationOptions(queryClient),
  );

  const handleSaveButtonClick = async () => {
    if (!target) return;
    if (!form.leaveStart || !form.leaveEnd) {
      alert("휴무 시작일과 종료일을 입력해주세요.");

      return;
    }

    // 유급은 잔여 연차가 모자라면 서버가 거절한다 — 저장을 누르기 전에 먼저 알려준다.
    // 역량활용은 만근한 달 수로 계산한 잔여라, 미리 받은 연차보다 많이 써서 0일 이하일 수 있다.
    if (form.leaveType === "PAID") {
      const leaveDays = toLeaveDays(form.leaveStart, form.leaveEnd);
      try {
        const balance = await queryClient.fetchQuery(
          participantAnnualLeaveQueryOptions(target.id, form.leaveStart.slice(0, 4)),
        );
        if (balance.remainingDays < leaveDays) {
          alert(
            balance.remainingDays <= 0
              ? `'${target.name}' 님은 ${balance.year}년 잔여 연차가 없어 유급휴무를 사용할 수 없습니다.\n(총 ${balance.totalDays}일 / 사용 ${balance.usedDays}일 / 잔여 ${balance.remainingDays}일)`
              : `'${target.name}' 님의 ${balance.year}년 잔여 연차가 부족해 유급휴무를 사용할 수 없습니다.\n(잔여 ${balance.remainingDays}일, 신청 ${leaveDays}일)`,
          );

          return;
        }
      } catch {
        // 잔여를 못 읽었으면 서버 검증에 맡긴다(서버도 같은 기준으로 거절한다)
      }
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
        onSuccess: () => {
          showToast(target ? `'${target.name}' 님의 휴무를 등록했습니다.` : "휴무를 등록했습니다.");
          onClose();
        },
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
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSaveButtonClick}>저장</Button>
        </>
      }
    >
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

export default ParticipantLeaveAddModal;
