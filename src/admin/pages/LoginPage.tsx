import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../api/auth";
import { useAuth } from "../context/useAuth";
import { btnPrimaryClass, inputClass } from "../uiClasses";

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
      setError(
        error instanceof Error ? error.message : "로그인에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-[#f3f4f6]">
      <div className="w-[360px] bg-white border border-[#e2e5eb] rounded-[10px] p-8">
        <div className="text-[15px] font-bold text-[#14283d] mb-1">
          기관 통합관리시스템
        </div>
        <p className="text-[13px] text-[#6b7280] mb-6">
          관리자 계정으로 로그인해주세요.
        </p>

        <label className="block text-[12.5px] font-semibold text-[#374151] mb-1.5">
          이메일
        </label>
        <input
          className={`${inputClass} mb-4`}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleLoginButtonClick();
          }}
        />

        <label className="block text-[12.5px] font-semibold text-[#374151] mb-1.5">
          비밀번호
        </label>
        <input
          type="password"
          className={`${inputClass} mb-5`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleLoginButtonClick();
          }}
        />

        {error && <p className="text-[12.5px] text-[#b42318] mb-4">{error}</p>}

        <button
          className={`${btnPrimaryClass} w-full py-3`}
          disabled={submitting}
          onClick={handleLoginButtonClick}
        >
          {submitting ? "로그인 중..." : "로그인"}
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
