import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { resetPassword } from "../api/auth";
import Button from "../components/Button";
import Input from "../components/Input";

/**
 * 관리자 페이지 > 비밀번호 찾기 이메일의 링크로 들어오는 재설정 페이지입니다.
 *
 */
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleResetButtonClick = async () => {
    if (!token) {
      setError("유효하지 않은 재설정 링크입니다.");

      return;
    }
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");

      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 서로 일치하지 않습니다.");

      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "재설정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-surface-page">
      <div className="w-[360px] bg-white border border-admin-border-subtle rounded-[10px] p-8">
        <div className="text-[15px] font-bold text-admin-navy-strong mb-1">비밀번호 재설정</div>

        {done ? (
          <>
            <p className="text-[13px] text-text-subtle mb-6">
              비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.
            </p>
            <Button className="w-full py-3" onClick={() => navigate("/admin/login")}>
              로그인하러 가기
            </Button>
          </>
        ) : !token ? (
          <p className="text-[13px] text-admin-error-text">
            유효하지 않은 재설정 링크입니다. 다시 비밀번호 찾기를 요청해주세요.
          </p>
        ) : (
          <>
            <p className="text-[13px] text-text-subtle mb-6">새로 사용할 비밀번호를 입력해주세요.</p>

            <label className="block text-[12.5px] font-semibold text-admin-text-secondary mb-1.5">
              새 비밀번호 (8자 이상)
            </label>
            <Input
              type="password"
              className="mb-4"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />

            <label className="block text-[12.5px] font-semibold text-admin-text-secondary mb-1.5">
              새 비밀번호 확인
            </label>
            <Input
              type="password"
              className="mb-5"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleResetButtonClick();
              }}
            />

            {error && <p className="text-[12.5px] text-admin-error-text mb-4">{error}</p>}

            <Button className="w-full py-3" disabled={submitting} onClick={handleResetButtonClick}>
              {submitting ? "변경 중..." : "비밀번호 변경"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
