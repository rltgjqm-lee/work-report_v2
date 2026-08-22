import type { ReactNode } from "react";

export type StatusChipVariant = "ok" | "warn" | "bad" | "pending" | "info";

const VARIANT_CLASSES: Record<StatusChipVariant, string> = {
  ok: "bg-admin-status-ok-bg text-admin-status-ok-text",
  warn: "bg-admin-status-warn-bg text-admin-status-warn-text",
  bad: "bg-admin-danger-tint text-admin-danger",
  pending: "bg-admin-status-pending-bg text-admin-status-pending-text",
  info: "bg-admin-status-info-bg text-admin-status-info-text",
};

interface StatusChipProps {
  variant: StatusChipVariant;
  children: ReactNode;
}

/**
 * 관리자 콘솔 전반에서 쓰는 상태 배지입니다. — 근무/교육/휴가
 * ok=정상/완료류, warn=지각 등 경미한 이상, bad=결근/취소/무효화류, pending=대기/비활성류.
 * info는 좋고 나쁨이 없는 분류 표시용(예: 사업 유형)
 */
const StatusChip = ({ variant, children }: StatusChipProps) => (
  <span
    className={`inline-flex whitespace-nowrap px-2.5 py-[3px] rounded-[2px] text-[11.5px] font-bold ${VARIANT_CLASSES[variant]}`}
  >
    {children}
  </span>
);

export default StatusChip;
