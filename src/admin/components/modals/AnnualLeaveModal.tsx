import { useEffect, useState } from "react";

import { getAnnualLeave, setAnnualLeave } from "../../api/admin/participants";
import SlideModal from "../SlideModal";
import FormField from "../FormField";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { AnnualLeave } from "../../types";

const currentYear = new Date().getFullYear().toString();

const emptyForm = {
  year: currentYear,
  totalDays: "",
};

interface AnnualLeaveModalProps {
  onClose: () => void;
  onSaved: () => void;
  target: { id: number; name: string } | null;
}

// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 아래 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
// 다만 연차 현황(balance)은 target에 대한 비동기 조회 결과라 effect가 남아있다.
const AnnualLeaveModal = ({
  onClose,
  onSaved,
  target,
}: AnnualLeaveModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const [balance, setBalance] = useState<AnnualLeave | null>(null);

  useEffect(() => {
    if (!target) return;

    getAnnualLeave(target.id, currentYear).then(setBalance);
  }, [target]);

  const handleSave = async () => {
    if (!target) return;
    if (!form.totalDays) {
      alert("총 연차 일수를 입력해주세요.");

      return;
    }
    try {
      const updated = await setAnnualLeave(target.id, {
        year: form.year,
        totalDays: Number(form.totalDays),
      });
      setBalance(updated);
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title={target ? `'${target.name}' 님 연차 설정` : "연차 설정"}
      onClose={onClose}
      footer={
        <>
          <button className={btnGhostClass} onClick={onClose}>
            닫기
          </button>
          <button className={btnPrimaryClass} onClick={handleSave}>
            저장
          </button>
        </>
      }
    >
      {balance && (
        <div className="text-xs text-[#6b7280] mb-3">
          {balance.year}년 현황 — 총 {balance.totalDays}일 / 사용{" "}
          {balance.usedDays}일 / 잔여 {balance.remainingDays}일
        </div>
      )}
      <FormField label="연도">
        <input
          className={inputClass}
          value={form.year}
          onChange={(event) =>
            setForm((f) => ({ ...f, year: event.target.value }))
          }
        />
      </FormField>
      <FormField label="총 연차 일수">
        <input
          type="number"
          className={inputClass}
          value={form.totalDays}
          onChange={(event) =>
            setForm((f) => ({ ...f, totalDays: event.target.value }))
          }
        />
      </FormField>
    </SlideModal>
  );
};

export default AnnualLeaveModal;
