import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateGroupMutationOptions } from "../../api/admin/groups";
import GroupAddModal from "./GroupAddModal";
import GroupMonthlyScheduleModal from "./GroupMonthlyScheduleModal";
import ItemCard from "../../components/ItemCard";
import { useToast } from "../../context/useToast";
import Button from "../../components/Button";
import type { Group } from "../../types/groups";

interface ProgramGroupsSectionProps {
  programId: number;
  groups: Group[];
  programEndDate: string;
  programStartTime: string;
  programEndTime: string;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지의 조 관리 섹션입니다.
 *
 */
const ProgramGroupsSection = ({
  programId,
  groups,
  programEndDate,
  programStartTime,
  programEndTime,
}: ProgramGroupsSectionProps) => {
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
    <div className="bg-white border border-admin-border-subtle rounded-[2px] mb-5">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-faint">
        <span className="text-sm font-bold">조 관리</span>
        <Button variant="ghost" onClick={() => setGroupModalOpen(true)}>
          + 조 추가
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 px-5 py-4">
        {groups.length === 0 && (
          <span className="text-[13px] text-admin-text-placeholder">등록된 조가 없습니다.</span>
        )}
        {groups.map((group) => (
          <ItemCard
            key={group.id}
            title={group.name}
            badge={{
              variant: group.isActive ? "ok" : "pending",
              label: group.isActive ? "활성" : "비활성",
            }}
            infoLine={
              <>
                <div>{group.participantCount}명</div>
                <div className="text-[13.5px] font-bold text-text-strong mt-1.5 mb-1">
                  {group.shiftStart}~{group.shiftEnd}
                </div>
              </>
            }
            actions={[
              { label: "수정", onClick: () => setScheduleTarget(group) },
              {
                label: group.isActive ? "비활성화" : "활성화",
                onClick: () => handleToggleActiveButtonClick(group),
              },
            ]}
          />
        ))}
      </div>

      {groupModalOpen && (
        <GroupAddModal
          onClose={() => setGroupModalOpen(false)}
          programId={programId}
          programEndDate={programEndDate}
          programStartTime={programStartTime}
          programEndTime={programEndTime}
        />
      )}

      {scheduleTarget && (
        <GroupMonthlyScheduleModal
          group={scheduleTarget}
          programEndDate={programEndDate}
          programStartTime={programStartTime}
          programEndTime={programEndTime}
          onClose={() => setScheduleTarget(null)}
        />
      )}
    </div>
  );
};

export default ProgramGroupsSection;
