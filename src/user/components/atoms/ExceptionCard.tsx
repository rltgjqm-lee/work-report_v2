import type { ReactNode } from "react";

interface ExceptionCardProps {
  variant: "warn" | "caution";
  title: ReactNode;
  body?: ReactNode;
  note: ReactNode;
  isLargeFontMode?: boolean;
}

const ICON_CLASS = {
  warn: "bg-danger-tint-strong text-danger-strong",
  caution: "bg-warn-tint text-warn-text",
};

/**
 * 등록 예외 상태(사업 없음/종료/시작 전, 참여자 휴무/탈락 등)를 안내하는 카드입니다.
 * warn: 담당자 문의가 필요한 상태, caution: 기간이 맞지 않는 상태.
 * body: 기관/사업명 등을 강조해 보여줘야 하는 상세 설명(있을 때만). note: 항상 보여주는 안내 문구.
 */
const ExceptionCard = ({
  variant,
  title,
  body,
  note,
  isLargeFontMode = false,
}: ExceptionCardProps) => (
  <div
    className={`flex flex-col items-center text-center bg-white border-[1.5px] border-border-faint rounded-[18px] shadow-[0_2px_8px_rgba(20,30,50,.05)] cursor-default ${
      isLargeFontMode ? "px-6 py-6" : "px-4 py-[18px]"
    }`}
  >
    <div
      className={`rounded-2xl font-extrabold flex items-center justify-center ${ICON_CLASS[variant]} ${
        isLargeFontMode ? "w-[72px] h-[72px] text-[34px]" : "w-14 h-14 text-[26px]"
      }`}
    >
      !
    </div>
    <span
      className={`font-extrabold text-text-strong ${
        isLargeFontMode ? "mt-5 text-[21px]" : "mt-3.5 text-[16px]"
      }`}
    >
      {title}
    </span>
    {body && (
      <span
        className={`leading-[1.6] font-semibold text-text-subtle whitespace-pre-line ${
          isLargeFontMode ? "mt-5 text-[18px]" : "mt-3.5 text-[13.5px]"
        }`}
      >
        {body}
      </span>
    )}
    <span
      className={`font-semibold text-text-muted whitespace-pre-line ${
        isLargeFontMode
          ? `text-[17px] ${body ? "mt-4" : "mt-5"}`
          : `text-[12.5px] ${body ? "mt-3" : "mt-3.5"}`
      }`}
    >
      {note}
    </span>
  </div>
);

export default ExceptionCard;
