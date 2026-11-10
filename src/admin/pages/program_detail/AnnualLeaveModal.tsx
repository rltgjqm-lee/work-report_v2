import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  participantAnnualLeaveQueryOptions,
  setAnnualLeaveMutationOptions,
} from "../../api/admin/participants";
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
    const isAutoAccrued = !!balance?.autoAccrued;
    const value = isAutoAccrued ? form.preSystemAccruedDays : form.totalDays;
    if (!value) {
      alert(isAutoAccrued ? "도입 전 만근 일수를 입력해주세요." : "총 연차 일수를 입력해주세요.");

      return;
    }
    setAnnualLeaveMutation.mutate(
      isAutoAccrued
        ? { participantId: target.id, year: form.year, preSystemAccruedDays: Number(value) }
        : { participantId: target.id, year: form.year, totalDays: Number(value) },
      {
        onSuccess: () => {
          showToast("연차를 저장했습니다.");
          onClose();
        },
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
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={handleSaveButtonClick}>저장</Button>
        </>
      }
    >
      {balance && (
        <div className="text-xs text-text-subtle mb-3">
          {balance.year}년 현황 — 총 {balance.totalDays}일 / 사용 {balance.usedDays}일 / 잔여{" "}
          {balance.remainingDays}일
        </div>
      )}
      {balance?.autoAccrued ? (
        <>
          <div className="text-[12.5px] text-text-subtle mb-3">
            역량활용 연차는 매월 1일~말일 60시간을 만근한 달마다 1일씩(최대 10일) 생깁니다. 시스템
            기록으로 센 만근 {balance.accruedDays}개월 + 도입 전 만근 {balance.preSystemAccruedDays}
            일 = 총 {balance.totalDays}일. 시스템을 쓰기 전 달은 출퇴근 기록이 없어 셀 수 없으니, 그
            기간에 만근한 달 수를 아래에 넣어주세요.
          </div>
          <FormField label="연도">
            <Input
              value={form.year}
              onChange={(event) => setForm((form) => ({ ...form, year: event.target.value }))}
            />
          </FormField>
          <FormField label="도입 전 만근 일수(0~10)">
            <Input
              type="number"
              min={0}
              max={10}
              value={form.preSystemAccruedDays}
              placeholder={`현재 ${balance.preSystemAccruedDays}일`}
              onChange={(event) =>
                setForm((form) => ({ ...form, preSystemAccruedDays: event.target.value }))
              }
            />
          </FormField>
        </>
      ) : (
        <>
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
        </>
      )}
    </SlideModal>
  );
};

export default AnnualLeaveModal;
