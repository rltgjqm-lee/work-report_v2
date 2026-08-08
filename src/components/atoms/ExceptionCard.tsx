import type { ReactNode } from "react";

interface ExceptionCardProps {
  variant: "warn" | "caution";
  title: ReactNode;
  body?: ReactNode;
  note: ReactNode;
}

const ICON_CLASS = {
  warn: "bg-[#fee2e2] text-[#dc2626]",
  caution: "bg-[#fef3c7] text-[#d97706]",
};

/**
 * 등록 예외 상태(사업 없음/종료/시작 전, 참여자 휴무/탈락 등)를 안내하는 카드입니다.
 * warn: 담당자 문의가 필요한 상태, caution: 기간이 맞지 않는 상태.
 * body: 기관/사업명 등을 강조해 보여줘야 하는 상세 설명(있을 때만). note: 항상 보여주는 안내 문구.
 */
const ExceptionCard = ({ variant, title, body, note }: ExceptionCardProps) => (
  <div className="flex flex-col items-center text-center bg-white border-[1.5px] border-[#eef0f3] rounded-[18px] px-4 py-[18px] shadow-[0_2px_8px_rgba(20,30,50,.05)] cursor-default">
    <div
      className={`w-14 h-14 rounded-2xl text-[26px] font-extrabold flex items-center justify-center ${ICON_CLASS[variant]}`}
    >
      !
    </div>
    <span className="mt-3.5 text-[16px] font-extrabold text-[#1f2937]">{title}</span>
    {body && (
      <span className="mt-3.5 text-[13.5px] leading-[1.6] font-semibold text-[#6b7280] whitespace-pre-line">
        {body}
      </span>
    )}
    <span
      className={`text-[12.5px] font-semibold text-[#9ca3af] whitespace-pre-line ${body ? "mt-3" : "mt-3.5"}`}
    >
      {note}
    </span>
  </div>
);

export default ExceptionCard;
