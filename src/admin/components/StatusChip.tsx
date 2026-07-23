import type { ReactNode } from "react";

export type StatusChipVariant = "ok" | "warn" | "bad" | "pending";

const VARIANT_CLASSES: Record<StatusChipVariant, string> = {
  ok: "bg-[#e8f3ea] text-[#2f7d3c]",
  warn: "bg-[#fdf3e0] text-[#a6690a]",
  bad: "bg-[#fbe9e9] text-[#c0392b]",
  pending: "bg-[#eef1f5] text-[#5b6472]",
};

interface StatusChipProps {
  variant: StatusChipVariant;
  children: ReactNode;
}

/**
 * 관리자 콘솔 전반에서 쓰는 상태 배지(pill) — 근태/교육/휴가 등 상태 표시가
 * 필요한 어느 페이지에서든 이 컴포넌트로 통일한다.
 * ok=정상/완료류, warn=지각 등 경미한 이상, bad=결근/취소/무효화류, pending=대기/비활성류.
 */
const StatusChip = ({ variant, children }: StatusChipProps) => (
  <span
    className={`inline-flex px-2.5 py-[3px] rounded-[2px] text-[11.5px] font-bold ${VARIANT_CLASSES[variant]}`}
  >
    {children}
  </span>
);

export default StatusChip;
