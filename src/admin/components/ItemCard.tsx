import type { ReactNode } from "react";

import StatusChip, { type StatusChipVariant } from "./chip/StatusChip";
import { zoneCardBtnClass } from "../uiClasses";

interface ItemCardAction {
  label: string;
  onClick: () => void;
}

interface ItemCardProps {
  title: string;
  badge?: { variant: StatusChipVariant; label: string };
  infoLine: ReactNode;
  tags?: string[];
  actions: ItemCardAction[];
  // compact: 조 관리 카드(p-3.5, 13.5px 제목) / comfortable: 교육 카드(p-[18px], 15px 제목)
  size?: "compact" | "comfortable";
}

const SIZE_CLASSES: Record<"compact" | "comfortable", { padding: string; title: string }> = {
  compact: { padding: "p-3.5", title: "text-[13.5px]" },
  comfortable: { padding: "p-[18px]", title: "text-[15px]" },
};

/**
 * grid로 나열되는 관리자 콘솔 카드 목록(조 관리, 교육 등)에서 공통으로 쓰는 카드입니다.
 * 거점 관리 카드(DemandSiteLocationsPanel)도 같은 디자인을 쓰지만 구조가 더 복잡해
 * 아직 이 컴포넌트로 옮기지 않았다.
 */
const ItemCard = ({ title, badge, infoLine, tags, actions, size = "compact" }: ItemCardProps) => (
  <div className={`bg-white border border-[#e2e5eb] rounded-lg ${SIZE_CLASSES[size].padding}`}>
    <div
      className={`flex items-center gap-1.5 font-bold text-[#1f2937] ${SIZE_CLASSES[size].title}`}
    >
      {title}
      {badge && <StatusChip variant={badge.variant}>{badge.label}</StatusChip>}
    </div>
    <div className="text-[12px] text-[#8b94a3] mt-1.5">{infoLine}</div>
    {tags && tags.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-[11.5px] font-semibold text-[#5b6472] bg-[#f3f4f6] px-2.5 py-1 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    )}
    <div className="flex items-center justify-end gap-2 mt-3.5 pt-3 border-t border-[#eef0f3]">
      {actions.map((action) => (
        <button key={action.label} className={zoneCardBtnClass} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  </div>
);

export default ItemCard;
