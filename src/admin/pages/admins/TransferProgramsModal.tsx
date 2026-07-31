import { useState } from "react";

import { transferAdminPrograms } from "../../api/admin/admins";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass } from "../../uiClasses";
import type { Admin } from "../../types";

interface TransferProgramsModalProps {
  onClose: () => void;
  onTransferred: () => void;
  target: Admin;
  candidates: Admin[];
}

/**
 * 관리자 페이지 > 관리자 계정 페이지에서 담당자의 담당 사업단을 다른 담당자에게
 * 이관하는 모달입니다. 퇴사 등으로 계정을 비활성화하기 전에 먼저 거치는 단계입니다.
 *
 */
// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const TransferProgramsModal = ({
  onClose,
  onTransferred,
  target,
  candidates,
}: TransferProgramsModalProps) => {
  const [toAdminId, setToAdminId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const targetName = target.name ?? target.email;

  const handleTransferButtonClick = async () => {
    if (!toAdminId) {
      setError("이관받을 담당자를 선택해주세요.");

      return;
    }
    try {
      const result = await transferAdminPrograms(target.id, Number(toAdminId));
      alert(
        `사업단 ${result.programCount}개, 수요처 ${result.demandSiteCount}곳의 담당자를 변경했습니다.`,
      );
      onTransferred();
    } catch (error) {
      setError(error instanceof Error ? error.message : "이관에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title={`'${targetName}' 님 담당 이관`}
      onClose={onClose}
      footer={
        <>
          <button className={btnGhostClass} onClick={onClose}>
            취소
          </button>
          <button
            className={btnPrimaryClass}
            onClick={handleTransferButtonClick}
          >
            이관
          </button>
        </>
      }
    >
      <p className="text-xs text-[#6b7280]">
        담당 사업단 {target.programIds.length}개를 넘깁니다. 해당 사업단의
        수요처 담당자도 함께 변경됩니다.
      </p>
      <FormField label="이관받을 담당자">
        {candidates.length === 0 ? (
          <p className="text-[12.5px] text-[#9aa1ab]">
            이관받을 수 있는 다른 담당자 계정이 없습니다. 담당자 계정을 먼저
            발급해주세요.
          </p>
        ) : (
          <FilterSelect
            className="w-full"
            value={toAdminId}
            onChange={setToAdminId}
            options={[
              { value: "", label: "선택하세요" },
              ...candidates.map((candidate) => ({
                value: String(candidate.id),
                label: candidate.name ?? candidate.email,
              })),
            ]}
          />
        )}
      </FormField>
      {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
    </SlideModal>
  );
};

export default TransferProgramsModal;
