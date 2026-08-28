import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";

import { forgotPassword, login } from "../api/auth";
import Button from "../components/Button";
import Input from "../components/Input";

/**
 * 관리자 페이지 > 로그인 페이지입니다.
 *
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const handleLoginButtonClick = async () => {
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");

      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      await refresh();
      navigate("/admin");
    } catch (error) {
      setError(error instanceof Error ? error.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPasswordLinkClick = () => {
    setMode("forgot");
    setForgotEmail(email);
    setForgotSent(false);
    setError(null);
  };

  const handleSendResetLinkButtonClick = async () => {
    if (!forgotEmail) {
      setError("이메일을 입력해주세요.");

      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToLoginLinkClick = () => {
    setMode("login");
    setError(null);
  };

  if (mode === "forgot") {
    return (
      <div className="flex items-center justify-center w-full min-h-screen bg-surface-page">
        <div className="w-[360px] bg-white border border-admin-border-subtle rounded-[10px] p-8">
          <div className="text-[15px] font-bold text-admin-navy-strong mb-1">비밀번호 찾기</div>

          {forgotSent ? (
            <>
              <p className="text-[13px] text-text-subtle mb-6">
                입력하신 이메일로 재설정 링크를 보냈습니다. 메일함을 확인해주세요(30분간 유효).
              </p>
              <Button className="w-full py-3" onClick={handleBackToLoginLinkClick}>
                로그인으로 돌아가기
              </Button>
            </>
          ) : (
            <>
              <p className="text-[13px] text-text-subtle mb-6">
                가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
              </p>

              <label className="block text-[12.5px] font-semibold text-admin-text-secondary mb-1.5">
                이메일
              </label>
              <Input
                className="mb-5"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSendResetLinkButtonClick();
                }}
              />

              {error && <p className="text-[12.5px] text-admin-error-text mb-4">{error}</p>}

              <Button
                className="w-full py-3"
                disabled={submitting}
                onClick={handleSendResetLinkButtonClick}
              >
                {submitting ? "전송 중..." : "재설정 링크 받기"}
              </Button>
              <button
                className="w-full text-center text-[12.5px] text-text-subtle mt-4 cursor-pointer"
                onClick={handleBackToLoginLinkClick}
              >
                로그인으로 돌아가기
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-surface-page">
      <div className="w-[360px] bg-white border border-admin-border-subtle rounded-[10px] p-8">
        <div className="text-[15px] font-bold text-admin-navy-strong mb-1">기관 통합관리시스템</div>
        <p className="text-[13px] text-text-subtle mb-6">관리자 계정으로 로그인해주세요.</p>

        <label className="block text-[12.5px] font-semibold text-admin-text-secondary mb-1.5">
          이메일
        </label>
        <Input
          className="mb-4"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleLoginButtonClick();
          }}
        />

        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[12.5px] font-semibold text-admin-text-secondary">
            비밀번호
          </label>
          <button
            className="text-[12px] text-admin-brand cursor-pointer"
            onClick={handleForgotPasswordLinkClick}
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>
        <Input
          type="password"
          className="mb-5"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleLoginButtonClick();
          }}
        />

        {error && <p className="text-[12.5px] text-admin-error-text mb-4">{error}</p>}

        <Button className="w-full py-3" disabled={submitting} onClick={handleLoginButtonClick}>
          {submitting ? "로그인 중..." : "로그인"}
        </Button>
      </div>
    </div>
  );
};

export default LoginPage;
