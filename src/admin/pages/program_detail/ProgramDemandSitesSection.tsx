import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  updateDemandSiteMutationOptions,
  deleteDemandSiteScheduleMutationOptions,
} from "../../api/admin/demandSites";
import DemandSiteFormModal from "./DemandSiteFormModal";
import DemandSiteScheduleAddModal from "./DemandSiteScheduleAddModal";
import DemandSiteLocationsPanel from "./DemandSiteLocationsPanel";
import { btnGhostClass, rowActionBtnClass } from "../../uiClasses";
import type { DemandSite, DemandSiteSchedule, Group } from "../../types";

interface ProgramDemandSitesSectionProps {
  programId: number;
  demandSites: DemandSite[];
  demandSiteSchedules: Record<number, DemandSiteSchedule[]>;
  groups: Group[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지의 수요처 관리 섹션입니다.
 *
 */
const ProgramDemandSitesSection = ({
  programId,
  demandSites,
  demandSiteSchedules,
  groups,
}: ProgramDemandSitesSectionProps) => {
  const [demandSiteModalOpen, setDemandSiteModalOpen] = useState(false);
  const [editingDemandSite, setEditingDemandSite] = useState<DemandSite | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTargetSiteId, setScheduleTargetSiteId] = useState<number | null>(null);
  const [expandedSiteId, setExpandedSiteId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const updateDemandSiteMutation = useMutation(updateDemandSiteMutationOptions(queryClient));
  const deleteDemandSiteScheduleMutation = useMutation(
    deleteDemandSiteScheduleMutationOptions(queryClient),
  );

  const activeGroups = useMemo(() => groups.filter((group) => group.isActive), [groups]);

  const handleAddButtonClick = () => {
    setEditingDemandSite(null);
    setDemandSiteModalOpen(true);
  };

  const handleEditButtonClick = (demandSite: DemandSite) => {
    setEditingDemandSite(demandSite);
    setDemandSiteModalOpen(true);
  };

  const handleToggleActiveButtonClick = (demandSite: DemandSite) => {
    const actionLabel = demandSite.isActive ? "비활성화" : "활성화";
    if (!confirm(`'${demandSite.name}' 수요처를 ${actionLabel}하시겠습니까?`)) return;

    updateDemandSiteMutation.mutate(
      { id: demandSite.id, programId, data: { isActive: !demandSite.isActive } },
      {
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleAddScheduleButtonClick = (siteId: number) => {
    setScheduleTargetSiteId(siteId);
    setScheduleModalOpen(true);
  };

  const handleDeleteScheduleButtonClick = (scheduleId: number, demandSiteId: number) => {
    if (!confirm("이 근무시간을 삭제하시겠습니까?")) return;

    deleteDemandSiteScheduleMutation.mutate(
      { scheduleId, demandSiteId },
      {
        onError: (error) => alert(error instanceof Error ? error.message : "삭제에 실패했습니다."),
      },
    );
  };

  return (
    <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1]">
        <span className="text-sm font-bold">수요처 관리</span>
        <button className={btnGhostClass} onClick={handleAddButtonClick}>
          + 수요처 추가
        </button>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">
        {demandSites.length === 0 && (
          <span className="text-[13px] text-[#9aa1ab]">등록된 수요처가 없습니다.</span>
        )}

        {demandSites.map((demandSite) => (
          <div key={demandSite.id} className="border border-[#e2e5eb] rounded-[2px] px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="font-semibold text-[13px]">{demandSite.name}</span>
                <span className="ml-2 text-xs text-[#6b7280]">
                  {demandSite.isActive ? "활성" : "비활성"}
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  className={rowActionBtnClass}
                  onClick={() =>
                    setExpandedSiteId((current) =>
                      current === demandSite.id ? null : demandSite.id,
                    )
                  }
                >
                  {expandedSiteId === demandSite.id ? "거점 편집 닫기" : "거점 관리"}
                </button>
                <button
                  className={rowActionBtnClass}
                  onClick={() => handleEditButtonClick(demandSite)}
                >
                  수정
                </button>
                <button
                  className={rowActionBtnClass}
                  onClick={() => handleToggleActiveButtonClick(demandSite)}
                >
                  {demandSite.isActive ? "비활성화" : "활성화"}
                </button>
              </div>
            </div>
            <div className="text-xs text-[#6b7280] mt-1">
              {demandSite.address && <span>{demandSite.address}</span>}

              {/* 계정 연결 이전에 자유 입력으로 쌓인 값(contactPerson)은 대체로 보여준다 */}
              {(demandSite.contactAdminName ?? demandSite.contactPerson) && (
                <span> · 담당자 {demandSite.contactAdminName ?? demandSite.contactPerson}</span>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
              {(demandSiteSchedules[demandSite.id] ?? []).map((schedule) => (
                <span
                  key={schedule.id}
                  className="flex items-center gap-1.5 border border-[#e2e5eb] rounded-[2px] px-2.5 py-1 text-[12.5px]"
                >
                  {schedule.groupName} {schedule.shiftStart}~{schedule.shiftEnd}
                  <button
                    className="bg-transparent border-none text-[#9aa1ab] cursor-pointer hover:text-[#b42318]"
                    onClick={() => handleDeleteScheduleButtonClick(schedule.id, demandSite.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                className={rowActionBtnClass}
                onClick={() => handleAddScheduleButtonClick(demandSite.id)}
              >
                + 근무시간
              </button>
            </div>

            {expandedSiteId === demandSite.id && (
              <DemandSiteLocationsPanel
                demandSite={demandSite}
                onClose={() => setExpandedSiteId(null)}
              />
            )}
          </div>
        ))}
      </div>

      {demandSiteModalOpen && (
        <DemandSiteFormModal
          onClose={() => setDemandSiteModalOpen(false)}
          programId={programId}
          editingDemandSite={editingDemandSite}
        />
      )}

      {scheduleModalOpen && (
        <DemandSiteScheduleAddModal
          onClose={() => setScheduleModalOpen(false)}
          targetSiteId={scheduleTargetSiteId}
          activeGroups={activeGroups}
        />
      )}
    </div>
  );
};

export default ProgramDemandSitesSection;
