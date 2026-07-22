import { useState } from "react";

import { resetAdminPassword } from "../../api/admin/admins";
import SlideModal from "../../components/SlideModal";
import FormField from "../../components/FormField";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";

interface ResetPasswordModalProps {
  onClose: () => void;
  target: { id: number; name: string } | null;
}

// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const ResetPasswordModal = ({ onClose, target }: ResetPasswordModalProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSaveButtonClick = async () => {
    if (!target) return;
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");

      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("새 비밀번호가 일치하지 않습니다.");

      return;
    }
    try {
      await resetAdminPassword(target.id, newPassword);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "재설정에 실패했습니다.",
      );
    }
  };

  return (
    <SlideModal
      isOpen
      title={target ? `'${target.name}' 님 비밀번호 재설정` : "비밀번호 재설정"}
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
      <p className="text-xs text-[#6b7280]">
        재설정하면 이 계정의 기존 로그인 세션이 모두 종료됩니다.
      </p>
      <FormField label="새 비밀번호 (8자 이상)">
        <input
          type="password"
          className={inputClass}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </FormField>
      <FormField label="새 비밀번호 확인">
        <input
          type="password"
          className={inputClass}
          value={newPasswordConfirm}
          onChange={(event) => setNewPasswordConfirm(event.target.value)}
        />
      </FormField>
      {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
    </SlideModal>
  );
};

export default ResetPasswordModal;
