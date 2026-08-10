import { useState } from "react";

import { changeMyPassword } from "../../api/admin/me";
import SlideModal from "./SlideModal";
import FormField from "../FormField";
import Button from "../Button";
import Input from "../Input";

interface ChangePasswordModalProps {
  onClose: () => void;
}

/**
 * 본인 비밀번호를 변경하는 모달입니다. AdminLayout 상단바에서 엽니다.
 *
 */
const ChangePasswordModal = ({ onClose }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSaveButtonClick = async () => {
    if (!currentPassword || !newPassword) {
      setError("현재 비밀번호와 새 비밀번호를 입력해주세요.");

      return;
    }
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");

      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("새 비밀번호가 일치하지 않습니다.");

      return;
    }
    try {
      await changeMyPassword(currentPassword, newPassword);
      alert("비밀번호가 변경되었습니다.");
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "변경에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title="비밀번호 변경"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSaveButtonClick}>
            저장
          </Button>
        </>
      }
    >
      <FormField label="현재 비밀번호">
        <Input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </FormField>

      <FormField label="새 비밀번호 (8자 이상)">
        <Input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </FormField>

      <FormField label="새 비밀번호 확인">
        <Input
          type="password"
          value={newPasswordConfirm}
          onChange={(event) => setNewPasswordConfirm(event.target.value)}
        />
      </FormField>

      {error && <p className="text-[12.5px] text-admin-error-text">{error}</p>}
    </SlideModal>
  );
};

export default ChangePasswordModal;
