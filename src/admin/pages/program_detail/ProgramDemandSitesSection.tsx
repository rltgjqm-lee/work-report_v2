import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateDemandSiteMutationOptions } from "../../api/admin/demandSites";
import { useToast } from "../../context/useToast";
import type { DemandSite } from "../../types/demandSites";
import type { Group } from "../../types/groups";

import Button from "../../components/Button";
import StatusChip from "../../components/chip/StatusChip";

import { rowActionBtnClass } from "../../uiClasses";
import DemandSiteFormModal from "./DemandSiteFormModal";
import DemandSiteGroupAssignModal from "./DemandSiteGroupAssignModal";
import DemandSiteLocationsPanel from "./DemandSiteLocationsPanel";

interface ProgramDemandSitesSectionProps {
  programId: number;
  demandSites: DemandSite[];
  groups: Group[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지의 수요처 관리 섹션입니다.
 *
 */
const ProgramDemandSitesSection = ({
  programId,
  demandSites,
  groups,
}: ProgramDemandSitesSectionProps) => {
  const [demandSiteModalOpen, setDemandSiteModalOpen] = useState(false);
  const [editingDemandSite, setEditingDemandSite] = useState<DemandSite | null>(null);
  const [groupAssignTarget, setGroupAssignTarget] = useState<DemandSite | null>(null);
  const [expandedSiteId, setExpandedSiteId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const updateDemandSiteMutation = useMutation(updateDemandSiteMutationOptions(queryClient));

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
        onSuccess: () => showToast(`'${demandSite.name}' 수요처를 ${actionLabel}했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  return (
    <div className="bg-white border border-admin-border-subtle rounded-[2px] mb-5">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-faint">
        <span className="text-sm font-bold">수요처 관리</span>
        <Button variant="ghost" onClick={handleAddButtonClick}>
          + 수요처 추가
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1230px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className="w-[32px] bg-admin-surface-header px-2 py-[11px] border-b border-admin-border-subtle" />
              <th className="w-[160px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                수요처명
              </th>
              <th className="w-[250px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                주소
              </th>
              <th className="w-[140px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                담당자
              </th>
              <th className="w-[150px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                조
              </th>
              <th className="w-[180px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                근무시간
              </th>
              <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                상태
              </th>
              <th className="w-[220px] bg-admin-surface-header border-b border-admin-border-subtle" />
            </tr>
          </thead>
          <tbody>
            {demandSites.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-4 text-[13px] text-admin-text-placeholder">
                  등록된 수요처가 없습니다.
                </td>
              </tr>
            )}

            {demandSites.map((demandSite) => (
              <Fragment key={demandSite.id}>
                <tr className="hover:bg-admin-row-hover">
                  <td className="px-2 py-[13px] text-[13px] border-b border-border-faint">
                    <button
                      className="w-7 h-7 border-none bg-transparent text-admin-text-secondary text-lg font-bold cursor-pointer p-0"
                      onClick={() =>
                        setExpandedSiteId((current) =>
                          current === demandSite.id ? null : demandSite.id,
                        )
                      }
                    >
                      {expandedSiteId === demandSite.id ? "▾" : "▸"}
                    </button>
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    {demandSite.name}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    {demandSite.address}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    {/* 계정 연결 이전에 자유 입력으로 쌓인 값(contactPerson)은 대체로 보여준다 */}
                    {demandSite.contactAdminName ?? demandSite.contactPerson}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    <button
                      className="text-left text-admin-brand underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      onClick={() => setGroupAssignTarget(demandSite)}
                    >
                      {(demandSite.schedules ?? []).length > 0
                        ? (demandSite.schedules ?? [])
                            .map((schedule) => schedule.groupName)
                            .join(", ")
                        : "조 배정"}
                    </button>
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    <div className="flex flex-col">
                      {(demandSite.schedules ?? []).map((schedule, index) => (
                        <span
                          key={schedule.id}
                          className={`py-1 whitespace-nowrap ${
                            index === 0 ? "" : "border-t border-border-faint"
                          }`}
                        >
                          {schedule.shiftStart} ~ {schedule.shiftEnd} ({schedule.groupName})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                    <StatusChip variant={demandSite.isActive ? "ok" : "pending"}>
                      {demandSite.isActive ? "활성" : "비활성"}
                    </StatusChip>
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
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
                  </td>
                </tr>
                {expandedSiteId === demandSite.id && (
                  <tr>
                    <td colSpan={8} className="p-3 bg-white border-b border-admin-border-subtle">
                      <DemandSiteLocationsPanel
                        demandSite={demandSite}
                        programId={programId}
                        onClose={() => setExpandedSiteId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {demandSiteModalOpen && (
        <DemandSiteFormModal
          onClose={() => setDemandSiteModalOpen(false)}
          programId={programId}
          editingDemandSite={editingDemandSite}
        />
      )}

      {groupAssignTarget && (
        <DemandSiteGroupAssignModal
          demandSite={groupAssignTarget}
          activeGroups={activeGroups}
          onClose={() => setGroupAssignTarget(null)}
        />
      )}
    </div>
  );
};

export default ProgramDemandSitesSection;
