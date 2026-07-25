import type { ReactNode } from "react";

interface ExceptionCardProps {
  variant: "warn" | "caution";
  children: ReactNode;
}

const VARIANT_CLASS = {
  warn: "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]",
  caution: "bg-[#fffbeb] border-[#fde68a] text-[#92400e]",
};

const ICON_CLASS = {
  warn: "bg-[#fee2e2] text-[#dc2626]",
  caution: "bg-[#fef3c7] text-[#d97706]",
};

/**
 * 등록 예외 상태(사업 없음/종료/시작 전, 참여자 휴무/탈락 등)를 안내하는 카드입니다.
 * warn: 담당자 문의가 필요한 상태, caution: 기간이 맞지 않는 상태.
 */
const ExceptionCard = ({ variant, children }: ExceptionCardProps) => (
  <div
    className={`border-[1.5px] rounded-2xl p-[22px] text-[15px] leading-[1.75] font-semibold ${VARIANT_CLASS[variant]}`}
  >
    <div
      className={`w-11 h-11 rounded-full text-[22px] font-extrabold flex items-center justify-center mx-auto mb-3 ${ICON_CLASS[variant]}`}
    >
      !
    </div>
    {children}
  </div>
);

export default ExceptionCard;
