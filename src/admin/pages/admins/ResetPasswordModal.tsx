import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { resetAdminPassword } from "../../api/admin/admins";
import { useToast } from "../../context/useToast";

import Button from "../../components/Button";
import FormField from "../../components/FormField";
import Input from "../../components/Input";
import SlideModal from "../../components/modal/SlideModal";

interface ResetPasswordModalProps {
  onClose: () => void;
  target: { id: number; name: string } | null;
}

interface ResetAdminPasswordVariables {
  id: number;
  newPassword: string;
}

/**
 * 관리자 페이지 > 관리자 계정의 비밀번호 재설정 모달입니다.
 *
 */
const ResetPasswordModal = ({ onClose, target }: ResetPasswordModalProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // 비밀번호 재설정은 admins 목록에 표시되는 데이터를 바꾸지 않아서(무효화할 캐시가 없음)
  // 다른 뮤테이션처럼 API 파일에 mutationOptions를 따로 만들지 않고 여기서 바로 쓴다.
  const resetAdminPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: ResetAdminPasswordVariables) =>
      resetAdminPassword(id, newPassword),
  });

  const handleSaveButtonClick = () => {
    if (!target) return;
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");

      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("새 비밀번호가 일치하지 않습니다.");

      return;
    }

    resetAdminPasswordMutation.mutate(
      { id: target.id, newPassword },
      {
        onSuccess: () => {
          showToast(`'${target.name}' 님의 비밀번호를 재설정했습니다.`);
          onClose();
        },
        onError: (error) =>
          setError(error instanceof Error ? error.message : "재설정에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title={target ? `'${target.name}' 님 비밀번호 재설정` : "비밀번호 재설정"}
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
      <p className="text-xs text-text-subtle">
        재설정하면 이 계정의 기존 로그인 세션이 모두 종료됩니다.
      </p>
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

export default ResetPasswordModal;
