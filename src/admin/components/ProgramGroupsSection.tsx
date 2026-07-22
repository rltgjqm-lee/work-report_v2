import { useState } from "react";

import { updateGroup } from "../api/admin/groups";
import GroupAddModal from "./modals/GroupAddModal";
import { btnGhostClass, rowActionBtnClass } from "../uiClasses";
import type { Group } from "../types";

interface ProgramGroupsSectionProps {
  programId: number;
  groups: Group[];
  onChanged: () => void;
}

const ProgramGroupsSection = ({
  programId,
  groups,
  onChanged,
}: ProgramGroupsSectionProps) => {
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const handleToggleActiveButtonClick = async (group: Group) => {
    const actionLabel = group.isActive ? "비활성화" : "활성화";
    if (!confirm(`'${group.name}' 조를 ${actionLabel}하시겠습니까?`)) return;

    try {
      await updateGroup(group.id, { isActive: !group.isActive });
      onChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  return (
    <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1]">
        <span className="text-sm font-bold">조 관리</span>
        <button
          className={btnGhostClass}
          onClick={() => setGroupModalOpen(true)}
        >
          + 조 추가
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5 px-5 py-4">
        {groups.length === 0 && (
          <span className="text-[13px] text-[#9aa1ab]">
            등록된 조가 없습니다.
          </span>
        )}
        {groups.map((group) => (
          <div
            key={group.id}
            className="flex items-center gap-2.5 border border-[#e2e5eb] rounded-[2px] px-3 py-2 text-[13px]"
          >
            <span className="font-semibold">{group.name}</span>
            <span className="text-[#6b7280]">
              {group.shiftStart}~{group.shiftEnd}
            </span>
            <span className="text-[#9aa1ab]">{group.participantCount}명</span>
            <span className="text-[#9aa1ab]">
              {group.isActive ? "활성" : "비활성"}
            </span>
            <button
              className={rowActionBtnClass}
              onClick={() => handleToggleActiveButtonClick(group)}
            >
              {group.isActive ? "비활성화" : "활성화"}
            </button>
          </div>
        ))}
      </div>

      {groupModalOpen && (
        <GroupAddModal
          onClose={() => setGroupModalOpen(false)}
          onSaved={() => {
            setGroupModalOpen(false);
            onChanged();
          }}
          programId={programId}
        />
      )}
    </div>
  );
};

export default ProgramGroupsSection;
