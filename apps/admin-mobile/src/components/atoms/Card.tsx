import type { ReactNode } from "react";

type CardProps = {
  className?: string;
  children: ReactNode;
};

// 회색 바탕 위의 흰 카드 — 화면 대부분의 묶음이 이 모양이다
const Card = ({ className = "", children }: CardProps) => (
  <div className={`rounded-[18px] bg-white shadow-[0_2px_8px_rgba(20,30,50,.05)] ${className}`}>
    {children}
  </div>
);

export default Card;
