import { useState } from "react";
import type { FormEvent } from "react";

import { useSession } from "../context/useSession";

const ADMIN_WEB_URL = import.meta.env.VITE_ADMIN_WEB_URL;

const LoginPage = () => {
  const { login, signOutMessage } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoginFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login(email.trim(), password);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그인에 실패했습니다.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-accent">
      <div className="flex flex-none flex-col gap-3.5 px-8 pt-14 pb-10">
        <img src="./app-icon.png" alt="" className="h-14 w-14 rounded-[18px]" />
        <h1 className="text-[28px] leading-snug font-extrabold text-white">관리자 로그인</h1>
        <p className="text-[15px] leading-relaxed font-semibold text-white/80">
          기관 담당자 계정으로 로그인하면
          <br />
          SOS와 구역 이탈을 바로 확인할 수 있어요
        </p>
      </div>
      <form
        onSubmit={handleLoginFormSubmit}
        className="flex flex-1 flex-col gap-4 rounded-t-[28px] bg-white px-6 pt-8 pb-7"
      >
        {signOutMessage && (
          <p className="rounded-2xl bg-escape-soft px-4 py-3 text-sm font-bold text-escape-ink">
            {signOutMessage}
          </p>
        )}
        <label className="flex flex-col gap-2">
          <span className="text-sm font-extrabold text-ink-sub">아이디</span>
          <input
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-[58px] rounded-2xl border-2 border-input-line px-[18px] text-base font-bold text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-extrabold text-ink-sub">비밀번호</span>
          <span className="flex h-[58px] items-center gap-2.5 rounded-2xl border-2 border-input-line px-[18px] focus-within:border-accent">
            <input
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-w-0 flex-1 text-base font-bold text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((visible) => !visible)}
              className="flex-none text-[13px] font-extrabold text-ink-muted"
            >
              {isPasswordVisible ? "숨기기" : "표시"}
            </button>
          </span>
        </label>
        {errorMessage && <p className="text-sm font-bold text-sos-ink">{errorMessage}</p>}
        <button
          type="submit"
          disabled={isSubmitting || !email.trim() || !password}
          className="mt-2 h-[58px] rounded-[18px] bg-accent text-[17px] font-extrabold text-white disabled:opacity-50"
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
        <a
          href={`${ADMIN_WEB_URL}/login`}
          target="_blank"
          rel="noreferrer"
          className="py-1 text-center text-sm font-extrabold text-ink-sub"
        >
          비밀번호 찾기
        </a>
        <p className="mt-auto text-center text-[13px] leading-relaxed font-semibold text-ink-muted">
          계정 문의는 소속 지자체 담당 부서
          <br />
          또는 시스템 관리자에게 연락해주세요
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
