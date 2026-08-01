import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  deleteParticipantMutationOptions,
  dropParticipantMutationOptions,
  endParticipantLeaveMutationOptions,
  moveParticipantToGroupMutationOptions,
  reactivateParticipantMutationOptions,
  bulkUpdateParticipantStatusMutationOptions,
} from "../../api/admin/participants";
import { programKeys } from "../../api/admin/programs";
import ParticipantLeaveAddModal from "./ParticipantLeaveAddModal";
import AnnualLeaveModal from "./AnnualLeaveModal";
import ParticipantMonthlyScheduleModal from "./ParticipantMonthlyScheduleModal";
import Pagination from "../../components/Pagination";
import SearchInput from "../../components/SearchInput";
import FilterSelect from "../../components/FilterSelect";
import { usePagination } from "../../hooks/usePagination";
import { rowActionBtnClass } from "../../uiClasses";
import type { Group, Participant } from "../../types";

const statusLabel: Record<string, string> = {
  ACTIVE: "활동중",
  ON_LEAVE: "휴무중",
  DROPPED: "참여종료",
};

interface ProgramParticipantsSectionProps {
  programId: number;
  participants: Participant[];
  groups: Group[];
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

  const queryClient = useQueryClient();
  const moveParticipantToGroupMutation = useMutation(
    moveParticipantToGroupMutationOptions(queryClient),
  );
  const dropParticipantMutation = useMutation(dropParticipantMutationOptions(queryClient));
  const endParticipantLeaveMutation = useMutation(endParticipantLeaveMutationOptions(queryClient));
  const reactivateParticipantMutation = useMutation(
    reactivateParticipantMutationOptions(queryClient),
  );
  const deleteParticipantMutation = useMutation(deleteParticipantMutationOptions(queryClient));
  const bulkUpdateParticipantStatusMutation = useMutation(
    bulkUpdateParticipantStatusMutationOptions(queryClient),
  );

  const handleParticipantSelectionChange = (participantId: number) => {
    setSelectedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
  };

  const handleGroupSelectChange = (participantId: number, groupId: string) => {
    if (!groupId) {
      // 미배정으로 되돌리는 API는 없다 — 방금 브라우저가 반영한 선택을 원래 값으로
      // 되돌리기 위해 참여자 목록을 다시 불러온다.
      queryClient.invalidateQueries({ queryKey: programKeys.detail(programId) });
      return;
    }
    moveParticipantToGroupMutation.mutate(
      { participantId, programId, groupId: Number(groupId) },
      {
        onError: (error) =>
          alert(error instanceof Error ? error.message : "조 배정에 실패했습니다."),
      },
    );
  };

  const handleLeaveButtonClick = (participantId: number, name: string) => {
    setLeaveTarget({ id: participantId, name });
    setLeaveModalOpen(true);
  };

  const handleAnnualSettingButtonClick = (participantId: number, name: string) => {
    setAnnualTarget({ id: participantId, name });
    setAnnualModalOpen(true);
  };

  const handleDropButtonClick = (participantId: number, name: string) => {
    const reason = prompt(`'${name}' 님의 참여종료 사유를 입력해주세요.`);

    if (reason === null) return;

    dropParticipantMutation.mutate(
      { participantId, programId, dropReason: reason || undefined },
      {
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleEndLeaveButtonClick = (participantId: number) => {
    endParticipantLeaveMutation.mutate(
      { participantId, programId },
      {
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleReactivateButtonClick = (participantId: number, name: string) => {
    if (!confirm(`'${name}' 님을 다시 활동중 상태로 되돌리시겠습니까?`)) return;

    reactivateParticipantMutation.mutate(
      { participantId, programId },
      {
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleDeleteButtonClick = (participantId: number, name: string) => {
    if (!confirm(`'${name}' 님을 참여자 명단에서 삭제하시겠습니까?`)) return;
    deleteParticipantMutation.mutate(
      { programId, participantId, name },
      {
        onError: (error) => alert(error instanceof Error ? error.message : "삭제에 실패했습니다."),
      },
    );
  };

  const handleBulkDropButtonClick = () => {
    const reason = prompt("일괄 참여종료 사유를 입력해주세요.");
    if (reason === null) return;

    bulkUpdateParticipantStatusMutation.mutate(
      {
        programId,
        participantIds: selectedParticipantIds,
        status: "DROPPED",
        dropReason: reason || undefined,
      },
      {
        onSuccess: () => setSelectedParticipantIds([]),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleBulkReactivateButtonClick = () => {
    if (!confirm(`선택한 ${selectedParticipantIds.length}명을 재활성화하시겠습니까?`)) return;

    bulkUpdateParticipantStatusMutation.mutate(
      { programId, participantIds: selectedParticipantIds, status: "ACTIVE" },
      {
        onSuccess: () => setSelectedParticipantIds([]),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  return (
    <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <SearchInput value={search} onChange={onSearchChange} placeholder="이름 검색" />
          <FilterSelect
            value={demandFilter}
            onChange={onDemandFilterChange}
            options={[
              { value: "all", label: "전체 수요처" },
              ...demandOptions.map((demandName) => ({
                value: demandName,
                label: demandName,
              })),
            ]}
          />
          <FilterSelect
            value={groupFilter}
            onChange={onGroupFilterChange}
            options={[
              { value: "all", label: "전체 조" },
              ...groups.map((group) => ({
                value: String(group.id),
                label: group.name,
              })),
            ]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={[
              { value: "all", label: "전체 상태" },
              { value: "ACTIVE", label: "활동중" },
              { value: "ON_LEAVE", label: "휴무중" },
              { value: "DROPPED", label: "참여종료" },
            ]}
          />
        </div>
        <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
          총 {participants.length}명
        </span>
      </div>

      {selectedParticipantIds.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#eceef1] bg-[#f5f8fb]">
          <span className="text-xs text-[#1e3a5f] font-semibold">
            {selectedParticipantIds.length}명 선택됨
          </span>
          <button className={rowActionBtnClass} onClick={handleBulkDropButtonClick}>
            일괄 참여종료
          </button>
          <button className={rowActionBtnClass} onClick={handleBulkReactivateButtonClick}>
            일괄 재활성화
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className="w-[40px] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]" />
              <th className="w-[70px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                번호
              </th>
              <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                이름
              </th>
              <th className="w-[180px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                수요처명
              </th>
              <th className="w-[130px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                조
              </th>
              <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                상태
              </th>
              <th className="w-[260px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((participant, index) => (
              <tr key={participant.id} className="hover:bg-[#f8fafc]">
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  <input
                    type="checkbox"
                    checked={selectedParticipantIds.includes(participant.id)}
                    onChange={() => handleParticipantSelectionChange(participant.id)}
                  />
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {(page - 1) * 15 + index + 1}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {participant.name}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                  {participant.demandName}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  <FilterSelect
                    value={String(participant.groupId ?? "")}
                    onChange={(value) => handleGroupSelectChange(participant.id, value)}
                    options={[
                      { value: "", label: "미배정" },
                      ...groups
                        .filter((group) => group.isActive || group.id === participant.groupId)
                        .map((group) => ({
                          value: String(group.id),
                          label: group.name,
                        })),
                    ]}
                  />
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {statusLabel[participant.status]}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
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
                        연차설정
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
                      onClick={() => handleEndLeaveButtonClick(participant.id)}
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
    </div>
  );
};

export default ProgramParticipantsSection;
