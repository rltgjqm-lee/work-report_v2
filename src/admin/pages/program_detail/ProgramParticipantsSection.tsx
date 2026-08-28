import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setGroupLeaderMutationOptions } from "../../api/admin/groups";
import {
  bulkUpdateParticipantStatusMutationOptions,
  deleteParticipantMutationOptions,
  dropParticipantMutationOptions,
  endParticipantLeaveMutationOptions,
  reactivateParticipantMutationOptions,
} from "../../api/admin/participants";
import { useToast } from "../../context/useToast";
import { usePagination } from "../../hooks/usePagination";
import type { DemandSite } from "../../types/demandSites";
import type { Group } from "../../types/groups";
import type { Participant } from "../../types/participants";

import FilterSelect from "../../components/FilterSelect";
import PromptModal from "../../components/modal/PromptModal";
import Pagination from "../../components/Pagination";
import SearchInput from "../../components/SearchInput";

import { rowActionBtnClass } from "../../uiClasses";
import AnnualLeaveModal from "./AnnualLeaveModal";
import BulkAnnualLeaveModal from "./BulkAnnualLeaveModal";
import BulkLeaveModal from "./BulkLeaveModal";
import ParticipantDemandSiteAssignModal from "./ParticipantDemandSiteAssignModal";
import ParticipantGroupAssignModal from "./ParticipantGroupAssignModal";
import ParticipantLeaveAddModal from "./ParticipantLeaveAddModal";
import ParticipantMonthlyScheduleModal from "./ParticipantMonthlyScheduleModal";

const statusLabel: Record<string, string> = {
  ACTIVE: "활동중",
  ON_LEAVE: "휴무중",
  DROPPED: "참여종료",
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "ACTIVE", label: "활동중" },
  { value: "ON_LEAVE", label: "휴무중" },
  { value: "DROPPED", label: "참여종료" },
];

interface ProgramParticipantsSectionProps {
  programId: number;
  participants: Participant[];
  groups: Group[];
  demandSites: DemandSite[];
  search: string;
  onSearchChange: (value: string) => void;
  demandOptions: string[];
  demandFilter: string;
  onDemandFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지의 참여자 관리 섹션입니다.
 *
 */
const ProgramParticipantsSection = ({
  programId,
  participants,
  groups,
  demandSites,
  search,
  onSearchChange,
  demandOptions,
  demandFilter,
  onDemandFilterChange,
  statusFilter,
  onStatusFilterChange,
  groupFilter,
  onGroupFilterChange,
}: ProgramParticipantsSectionProps) => {
  const { page, totalPages, pageItems, setPage } = usePagination(participants, 15);

  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [annualModalOpen, setAnnualModalOpen] = useState(false);
  const [annualTarget, setAnnualTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Participant | null>(null);
  const [groupAssignTarget, setGroupAssignTarget] = useState<Participant | null>(null);
  const [demandSiteAssignTarget, setDemandSiteAssignTarget] = useState<Participant | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: number; name: string } | null>(null);
  const [bulkDropPromptOpen, setBulkDropPromptOpen] = useState(false);
  const [bulkLeaveModalOpen, setBulkLeaveModalOpen] = useState(false);
  const [bulkAnnualModalOpen, setBulkAnnualModalOpen] = useState(false);

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const dropParticipantMutation = useMutation(dropParticipantMutationOptions(queryClient));
  const endParticipantLeaveMutation = useMutation(endParticipantLeaveMutationOptions(queryClient));
  const reactivateParticipantMutation = useMutation(
    reactivateParticipantMutationOptions(queryClient),
  );
  const deleteParticipantMutation = useMutation(deleteParticipantMutationOptions(queryClient));
  const bulkUpdateParticipantStatusMutation = useMutation(
    bulkUpdateParticipantStatusMutationOptions(queryClient),
  );
  const setGroupLeaderMutation = useMutation(setGroupLeaderMutationOptions(queryClient));

  const handleParticipantSelectionChange = (participantId: number) => {
    setSelectedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
  };

  // 현재 필터에 걸린 전체 결과 기준으로 선택한다(페이지에 보이는 것만이 아니라) —
  // 일괄 처리 대상을 "이 조건에 맞는 전원"으로 고르는 게 자연스럽다.
  const allFilteredSelected =
    participants.length > 0 &&
    participants.every((participant) => selectedParticipantIds.includes(participant.id));

  const handleSelectAllChange = () => {
    setSelectedParticipantIds(
      allFilteredSelected ? [] : participants.map((participant) => participant.id),
    );
  };

  const selectedTargets = participants
    .filter((participant) => selectedParticipantIds.includes(participant.id))
    .map((participant) => ({ id: participant.id, name: participant.name }));

  const handleLeaveButtonClick = (participantId: number, name: string) => {
    setLeaveTarget({ id: participantId, name });
    setLeaveModalOpen(true);
  };

  const handleAnnualSettingButtonClick = (participantId: number, name: string) => {
    setAnnualTarget({ id: participantId, name });
    setAnnualModalOpen(true);
  };

  const handleDropButtonClick = (participantId: number, name: string) => {
    setDropTarget({ id: participantId, name });
  };

  const handleDropPromptConfirm = (reason: string) => {
    if (!dropTarget) return;
    const { id: participantId, name } = dropTarget;
    setDropTarget(null);

    dropParticipantMutation.mutate(
      { participantId, programId, dropReason: reason || undefined },
      {
        onSuccess: () => showToast(`'${name}' 님을 참여종료 처리했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleEndLeaveButtonClick = (participantId: number, name: string) => {
    endParticipantLeaveMutation.mutate(
      { participantId, programId },
      {
        onSuccess: () => showToast(`'${name}' 님의 휴무를 종료했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleReactivateButtonClick = (participantId: number, name: string) => {
    if (!confirm(`'${name}' 님을 다시 활동중 상태로 되돌리시겠습니까?`)) return;

    reactivateParticipantMutation.mutate(
      { participantId, programId },
      {
        onSuccess: () => showToast(`'${name}' 님을 다시 활동중 상태로 되돌렸습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleSetLeaderButtonClick = (participant: Participant) => {
    const group = groups.find((group) => group.id === participant.groupId);
    if (!group) return;

    const confirmMessage = group.leaderId
      ? `'${group.leaderName}' 님 대신 '${participant.name}' 님을 '${group.name}' 조의 팀장으로 지정하시겠습니까?`
      : `'${participant.name}' 님을 '${group.name}' 조의 팀장으로 지정하시겠습니까?`;
    if (!confirm(confirmMessage)) return;

    setGroupLeaderMutation.mutate(
      { groupId: group.id, programId, participantId: participant.id },
      {
        onSuccess: () => showToast(`'${participant.name}' 님을 팀장으로 지정했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleUnsetLeaderButtonClick = (participant: Participant) => {
    const group = groups.find((group) => group.id === participant.groupId);
    if (!group) return;
    if (!confirm(`'${participant.name}' 님의 팀장 지정을 해제하시겠습니까?`)) return;

    setGroupLeaderMutation.mutate(
      { groupId: group.id, programId, participantId: null },
      {
        onSuccess: () => showToast(`'${participant.name}' 님의 팀장 지정을 해제했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleDeleteButtonClick = (participantId: number, name: string) => {
    if (!confirm(`'${name}' 님을 참여자 명단에서 삭제하시겠습니까?`)) return;
    deleteParticipantMutation.mutate(
      { programId, participantId, name },
      {
        onSuccess: () => showToast(`'${name}' 님을 삭제했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "삭제에 실패했습니다."),
      },
    );
  };

  const handleBulkDropButtonClick = () => {
    setBulkDropPromptOpen(true);
  };

  const handleBulkDropPromptConfirm = (reason: string) => {
    setBulkDropPromptOpen(false);

    bulkUpdateParticipantStatusMutation.mutate(
      {
        programId,
        participantIds: selectedParticipantIds,
        status: "DROPPED",
        dropReason: reason || undefined,
      },
      {
        onSuccess: () => {
          showToast(`${selectedParticipantIds.length}명을 일괄 참여종료 처리했습니다.`);
          setSelectedParticipantIds([]);
        },
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleBulkReactivateButtonClick = () => {
    if (!confirm(`선택한 ${selectedParticipantIds.length}명을 재활성화하시겠습니까?`)) return;

    bulkUpdateParticipantStatusMutation.mutate(
      { programId, participantIds: selectedParticipantIds, status: "ACTIVE" },
      {
        onSuccess: () => {
          showToast(`${selectedParticipantIds.length}명을 일괄 재활성화했습니다.`);
          setSelectedParticipantIds([]);
        },
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleBulkLeaveButtonClick = () => {
    setBulkLeaveModalOpen(true);
  };

  const handleBulkAnnualButtonClick = () => {
    setBulkAnnualModalOpen(true);
  };

  const demandSiteOptions = [
    { value: "all", label: "전체 수요처" },
    ...demandOptions.map((demandName) => ({
      value: demandName,
      label: demandName,
    })),
  ];

  const groupOptions = [
    { value: "all", label: "전체 조" },
    ...groups.map((group) => ({
      value: String(group.id),
      label: group.name,
    })),
  ];

  return (
    <div className="bg-white border border-admin-border-subtle rounded-[2px]">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-faint flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <SearchInput value={search} onChange={onSearchChange} placeholder="이름 검색" />
          <FilterSelect
            value={demandFilter}
            onChange={onDemandFilterChange}
            options={demandSiteOptions}
          />
          <FilterSelect value={groupFilter} onChange={onGroupFilterChange} options={groupOptions} />
          <FilterSelect
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={STATUS_FILTER_OPTIONS}
          />
        </div>
        <span className="text-xs text-text-subtle font-medium whitespace-nowrap">
          총 {participants.length}명
        </span>
      </div>

      {selectedParticipantIds.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border-faint bg-admin-selected-tint">
          <span className="text-xs text-admin-brand font-semibold">
            {selectedParticipantIds.length}명 선택됨
          </span>
          <button className={rowActionBtnClass} onClick={handleBulkLeaveButtonClick}>
            일괄 휴무
          </button>
          <button className={rowActionBtnClass} onClick={handleBulkAnnualButtonClick}>
            일괄 연차
          </button>
          <button className={rowActionBtnClass} onClick={handleBulkDropButtonClick}>
            일괄 참여종료
          </button>
          <button className={rowActionBtnClass} onClick={handleBulkReactivateButtonClick}>
            일괄 재활성화
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className="w-[40px] text-left bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                <input type="checkbox" checked={allFilteredSelected} onChange={handleSelectAllChange} />
              </th>
              <th className="w-[70px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                번호
              </th>
              <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                이름
              </th>
              <th className="w-[60px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                성별
              </th>
              <th className="w-[180px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                수요처명
              </th>
              <th className="w-[130px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                조
              </th>
              <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                상태
              </th>
              <th className="w-[260px] bg-admin-surface-header border-b border-admin-border-subtle" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((participant, index) => (
              <tr key={participant.id} className="hover:bg-admin-row-hover">
                <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                  <input
                    type="checkbox"
                    checked={selectedParticipantIds.includes(participant.id)}
                    onChange={() => handleParticipantSelectionChange(participant.id)}
                  />
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                  {(page - 1) * 15 + index + 1}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                  {participant.name}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                  {participant.gender ?? "-"}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                  <button
                    className="text-left text-admin-brand underline decoration-dotted underline-offset-2 hover:decoration-solid"
                    onClick={() => setDemandSiteAssignTarget(participant)}
                  >
                    {participant.demandName ?? "미배정"}
                  </button>
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                  <button
                    className="text-left text-admin-brand underline decoration-dotted underline-offset-2 hover:decoration-solid"
                    onClick={() => setGroupAssignTarget(participant)}
                  >
                    {groups.find((group) => group.id === participant.groupId)?.name ?? "미배정"}
                  </button>
                  {participant.todayGroupOverride && (
                    <span className="ml-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      오늘만 {participant.todayGroupOverride.groupName}
                    </span>
                  )}
                  {groups.find((group) => group.id === participant.groupId)?.leaderId ===
                    participant.id && (
                    <span className="ml-1.5 inline-block rounded-full bg-admin-selected-tint px-2 py-0.5 text-[11px] font-medium text-admin-brand">
                      팀장
                    </span>
                  )}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                  {statusLabel[participant.status]}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                  {participant.status === "ACTIVE" && participant.groupId && (
                    <>
                      {groups.find((group) => group.id === participant.groupId)?.leaderId ===
                      participant.id ? (
                        <button
                          className={rowActionBtnClass}
                          onClick={() => handleUnsetLeaderButtonClick(participant)}
                        >
                          팀장 해제
                        </button>
                      ) : (
                        <button
                          className={rowActionBtnClass}
                          onClick={() => handleSetLeaderButtonClick(participant)}
                        >
                          팀장 지정
                        </button>
                      )}
                    </>
                  )}
                  {participant.status === "ACTIVE" && (
                    <>
                      <button
                        className={rowActionBtnClass}
                        onClick={() => handleLeaveButtonClick(participant.id, participant.name)}
                      >
                        휴무
                      </button>
                      <button
                        className={rowActionBtnClass}
                        onClick={() =>
                          handleAnnualSettingButtonClick(participant.id, participant.name)
                        }
                      >
                        연차
                      </button>
                      <button
                        className={rowActionBtnClass}
                        onClick={() => setScheduleTarget(participant)}
                      >
                        개인 스케줄
                      </button>
                      <button
                        className={rowActionBtnClass}
                        onClick={() => handleDropButtonClick(participant.id, participant.name)}
                      >
                        참여종료
                      </button>
                    </>
                  )}
                  {participant.status === "ON_LEAVE" && (
                    <button
                      className={rowActionBtnClass}
                      onClick={() => handleEndLeaveButtonClick(participant.id, participant.name)}
                    >
                      복귀
                    </button>
                  )}
                  {participant.status === "DROPPED" && (
                    <button
                      className={rowActionBtnClass}
                      onClick={() => handleReactivateButtonClick(participant.id, participant.name)}
                    >
                      재활성화
                    </button>
                  )}
                  <button
                    className={rowActionBtnClass}
                    onClick={() => handleDeleteButtonClick(participant.id, participant.name)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {leaveModalOpen && (
        <ParticipantLeaveAddModal
          onClose={() => setLeaveModalOpen(false)}
          programId={programId}
          target={leaveTarget}
        />
      )}

      {annualModalOpen && (
        <AnnualLeaveModal onClose={() => setAnnualModalOpen(false)} target={annualTarget} />
      )}

      {scheduleTarget && (
        <ParticipantMonthlyScheduleModal
          participant={scheduleTarget}
          group={groups.find((group) => group.id === scheduleTarget.groupId)}
          onClose={() => setScheduleTarget(null)}
        />
      )}

      {groupAssignTarget && (
        <ParticipantGroupAssignModal
          participant={groupAssignTarget}
          programId={programId}
          groups={groups}
          onClose={() => setGroupAssignTarget(null)}
        />
      )}

      {demandSiteAssignTarget && (
        <ParticipantDemandSiteAssignModal
          participant={demandSiteAssignTarget}
          programId={programId}
          demandSites={demandSites}
          onClose={() => setDemandSiteAssignTarget(null)}
        />
      )}

      {dropTarget && (
        <PromptModal
          title={`'${dropTarget.name}' 님의 참여종료 사유를 입력해주세요.`}
          onConfirm={handleDropPromptConfirm}
          onCancel={() => setDropTarget(null)}
        />
      )}

      {bulkDropPromptOpen && (
        <PromptModal
          title="일괄 참여종료 사유를 입력해주세요."
          onConfirm={handleBulkDropPromptConfirm}
          onCancel={() => setBulkDropPromptOpen(false)}
        />
      )}

      {bulkLeaveModalOpen && (
        <BulkLeaveModal
          onClose={() => setBulkLeaveModalOpen(false)}
          onSaved={() => setSelectedParticipantIds([])}
          programId={programId}
          targets={selectedTargets}
        />
      )}

      {bulkAnnualModalOpen && (
        <BulkAnnualLeaveModal
          onClose={() => setBulkAnnualModalOpen(false)}
          onSaved={() => setSelectedParticipantIds([])}
          programId={programId}
          targets={selectedTargets}
        />
      )}
    </div>
  );
};

export default ProgramParticipantsSection;
