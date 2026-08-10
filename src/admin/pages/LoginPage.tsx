import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../api/auth";
import { useAuth } from "../context/useAuth";
import Button from "../components/Button";
import Input from "../components/Input";

/**
 * 관리자 페이지 > 로그인 페이지입니다.
 *
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-surface-page">
      <div className="w-[360px] bg-white border border-admin-border-subtle rounded-[10px] p-8">
        <div className="text-[15px] font-bold text-admin-navy-strong mb-1">기관 통합관리시스템</div>
        <p className="text-[13px] text-text-subtle mb-6">관리자 계정으로 로그인해주세요.</p>

        <label className="block text-[12.5px] font-semibold text-admin-text-secondary mb-1.5">이메일</label>
        <Input
          className="mb-4"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleLoginButtonClick();
          }}
        />

        <label className="block text-[12.5px] font-semibold text-admin-text-secondary mb-1.5">비밀번호</label>
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

        <Button
          className="w-full py-3"
          disabled={submitting}
          onClick={handleLoginButtonClick}
        >
          {submitting ? "로그인 중..." : "로그인"}
        </Button>
      </div>
    </div>
  );
};

export default LoginPage;
