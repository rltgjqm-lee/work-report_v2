import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { ChevronLeft } from "lucide-react";

type DetailHeaderProps = {
  title: string;
  fallbackPath: string;
  children?: ReactNode;
};

// 상세 화면 남색 헤더 — 뒤로 가기. 알림을 눌러 바로 들어온 경우엔 돌아갈 화면이 없어서
// fallbackPath로 보낸다.
const DetailHeader = ({ title, fallbackPath, children }: DetailHeaderProps) => {
  const navigate = useNavigate();

  const handleBackButtonClick = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(fallbackPath, { replace: true });
  };

  return (
    <header className="flex flex-none flex-col gap-5 bg-accent px-5 pt-4 pb-6">
      <button
        type="button"
        onClick={handleBackButtonClick}
        className="flex items-center gap-2.5 self-start text-[17px] font-extrabold text-white"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
          <ChevronLeft size={22} aria-hidden="true" />
        </span>
        {title}
      </button>
      {children}
    </header>
  );
};

export default DetailHeader;
