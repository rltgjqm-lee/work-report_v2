import type { ReactNode } from "react";

interface AppBarProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

const AppBar = ({ title, onBack, right }: AppBarProps) => (
  <div className="h-[60px] flex-none flex items-center gap-3 px-[18px] bg-white border-b border-[#f2f4f6]">
    {onBack ? (
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-xl bg-[#f2f4f6] border-none text-[20px] text-[#333d4b] flex items-center justify-center flex-none cursor-pointer"
        aria-label="뒤로가기"
      >
        ‹
      </button>
    ) : (
      <span className="w-10 flex-none" />
    )}
    <span className="flex-1 text-center text-[18px] font-extrabold text-[#1f2937]">
      {title}
    </span>
    {right ?? <span className="w-10 flex-none" />}
  </div>
);

export default AppBar;
