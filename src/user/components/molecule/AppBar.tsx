import type { ReactNode } from "react";

import { ChevronLeft, Home } from "lucide-react";

interface AppBarProps {
  title: string;
  onBack?: () => void;
  onHome?: () => void;
  right?: ReactNode;
}

const AppBar = ({ title, onBack, onHome, right }: AppBarProps) => (
  <div className="h-[60px] flex-none sticky top-0 z-10 flex items-center gap-1.5 px-[18px] bg-white border-b border-surface-page">
    {onBack && (
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-xl bg-surface-page border-none flex items-center justify-center flex-none cursor-pointer"
        aria-label="이전으로"
      >
        <ChevronLeft size={22} color="#333d4b" strokeWidth={2.2} />
      </button>
    )}
    {onHome && (
      <button
        onClick={onHome}
        className="w-10 h-10 rounded-xl bg-surface-page border-none flex items-center justify-center flex-none cursor-pointer"
        aria-label="홈으로"
      >
        <Home size={19} color="#333d4b" strokeWidth={2.2} />
      </button>
    )}
    {!onBack && !onHome && <span className="w-10 flex-none" />}
    <span className="flex-1 text-center text-[18px] font-extrabold text-text-strong">{title}</span>
    {right ?? <span className="w-10 flex-none" />}
  </div>
);

export default AppBar;
