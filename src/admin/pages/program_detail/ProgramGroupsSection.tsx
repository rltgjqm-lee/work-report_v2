import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateGroupMutationOptions } from "../../api/admin/groups";
import GroupAddModal from "./GroupAddModal";
import GroupMonthlyScheduleModal from "./GroupMonthlyScheduleModal";
import StatusChip from "../../components/chip/StatusChip";
import { useToast } from "../../context/useToast";
import { btnGhostClass, zoneCardBtnClass, zoneCardFooterClass } from "../../uiClasses";
import type { Group } from "../../types";

interface ProgramGroupsSectionProps {
  programId: number;
  groups: Group[];
  programEndDate: string;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지의 조 관리 섹션입니다.
 *
 */
const ProgramGroupsSection = ({ programId, groups, programEndDate }: ProgramGroupsSectionProps) => {
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<Group | null>(null);

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const updateGroupMutation = useMutation(updateGroupMutationOptions(queryClient));

  const handleToggleActiveButtonClick = (group: Group) => {
    const actionLabel = group.isActive ? "비활성화" : "활성화";

    if (!confirm(`'${group.name}' 조를 ${actionLabel}하시겠습니까?`)) return;

    updateGroupMutation.mutate(
      { id: group.id, programId, data: { isActive: !group.isActive } },
      {
        onSuccess: () => showToast(`'${group.name}' 조를 ${actionLabel}했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  return (
    <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1]">
        <span className="text-sm font-bold">조 관리</span>
        <button className={btnGhostClass} onClick={() => setGroupModalOpen(true)}>
          + 조 추가
        </button>
      </div>
      <div className="flex flex-wrap gap-3 px-5 py-4">
        {groups.length === 0 && (
          <span className="text-[13px] text-[#9aa1ab]">등록된 조가 없습니다.</span>
        )}
        {groups.map((group) => (
          <div
            key={group.id}
            className="w-[220px] bg-white border border-[#e2e5eb] rounded-lg p-3.5"
          >
            <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#1f2937]">
              {group.name}
              <StatusChip variant={group.isActive ? "ok" : "pending"}>
                {group.isActive ? "활성" : "비활성"}
              </StatusChip>
            </div>
            <div className="text-[12px] text-[#8b94a3] mt-1.5">
              {group.shiftStart}~{group.shiftEnd} · {group.participantCount}명
            </div>
            <div className={zoneCardFooterClass}>
              <button className={zoneCardBtnClass} onClick={() => setScheduleTarget(group)}>
                수정
              </button>
              <button
                className={zoneCardBtnClass}
                onClick={() => handleToggleActiveButtonClick(group)}
              >
                {group.isActive ? "비활성화" : "활성화"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {groupModalOpen && (
        <GroupAddModal
          onClose={() => setGroupModalOpen(false)}
          programId={programId}
          programEndDate={programEndDate}
        />
      )}

      {scheduleTarget && (
        <GroupMonthlyScheduleModal
          group={scheduleTarget}
          programEndDate={programEndDate}
          onClose={() => setScheduleTarget(null)}
        />
      )}
    </div>
  );
};

export default ProgramGroupsSection;
