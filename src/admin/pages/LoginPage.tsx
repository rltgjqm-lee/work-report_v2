import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { inputClass, btnPrimaryClass } from "../uiClasses";

const LoginPage = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/admin/organizations" replace />;

  const handleClickSubmitButton = async (e: FormEvent) => {
    e.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate("/admin/organizations", { replace: true });
    } catch {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-[#f3f4f6] font-sans">
      <form
        onSubmit={handleClickSubmitButton}
        className="w-[360px] bg-white border border-[#e2e5eb] rounded-[10px] p-8 flex flex-col gap-5"
      >
        <div>
          <div className="text-[17px] font-bold text-[#14283d]">
            기관 통합관리시스템
          </div>
          <div className="text-[12px] text-[#6b7280] mt-1">관리자 로그인</div>
        </div>

        <div>
          <label className="block text-[12.5px] font-semibold text-[#374151] mb-1.5">
            아이디
          </label>
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-[12.5px] font-semibold text-[#374151] mb-1.5">
            비밀번호
          </label>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}

        <button
          type="submit"
          className={btnPrimaryClass}
          disabled={isSubmitting}
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
