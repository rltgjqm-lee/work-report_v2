import { useState } from "react";

import {
  deleteParticipant,
  dropParticipant,
  endParticipantLeave,
  moveParticipantToGroup,
  reactivateParticipant,
  bulkUpdateParticipantStatus,
} from "../../api/admin/participants";
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
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  onChanged: () => void;
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
  statusFilter,
  onStatusFilterChange,
  groupFilter,
  onGroupFilterChange,
  onChanged,
}: ProgramParticipantsSectionProps) => {
  const { page, totalPages, pageItems, setPage } = usePagination(
    participants,
    15,
  );
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    number[]
  >([]);
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
  const [scheduleTarget, setScheduleTarget] = useState<Participant | null>(
    null,
  );

  const handleParticipantSelectionChange = (participantId: number) => {
    setSelectedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
  };

  const handleGroupSelectChange = async (
    participantId: number,
    groupId: string,
  ) => {
    try {
      if (groupId) await moveParticipantToGroup(participantId, Number(groupId));
      onChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "조 배정에 실패했습니다.");
    }
  };

  const handleLeaveButtonClick = (participantId: number, name: string) => {
    setLeaveTarget({ id: participantId, name });
    setLeaveModalOpen(true);
  };

  const handleAnnualSettingButtonClick = (
    participantId: number,
    name: string,
  ) => {
    setAnnualTarget({ id: participantId, name });
    setAnnualModalOpen(true);
  };

  const handleDropButtonClick = async (participantId: number, name: string) => {
    const reason = prompt(`'${name}' 님의 참여종료 사유를 입력해주세요.`);

    if (reason === null) return;

    try {
      await dropParticipant(participantId, reason || undefined);
      onChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleEndLeaveButtonClick = async (participantId: number) => {
    try {
      await endParticipantLeave(participantId);
      onChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleReactivateButtonClick = async (
    participantId: number,
    name: string,
  ) => {
    if (!confirm(`'${name}' 님을 다시 활동중 상태로 되돌리시겠습니까?`)) return;

    try {
      await reactivateParticipant(participantId);
      onChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleDeleteButtonClick = async (
    participantId: number,
    name: string,
  ) => {
    if (!confirm(`'${name}' 님을 참여자 명단에서 삭제하시겠습니까?`)) return;
    try {
      await deleteParticipant(programId, participantId);
      onChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  const handleBulkDropButtonClick = async () => {
    const reason = prompt("일괄 참여종료 사유를 입력해주세요.");
    if (reason === null) return;

    try {
      await bulkUpdateParticipantStatus(programId, {
        participantIds: selectedParticipantIds,
        status: "DROPPED",
        dropReason: reason || undefined,
      });
      setSelectedParticipantIds([]);
      onChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleBulkReactivateButtonClick = async () => {
    if (
      !confirm(
        `선택한 ${selectedParticipantIds.length}명을 재활성화하시겠습니까?`,
      )
    )
      return;

    try {
      await bulkUpdateParticipantStatus(programId, {
        participantIds: selectedParticipantIds,
        status: "ACTIVE",
      });
      setSelectedParticipantIds([]);
      onChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  return (
    <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="이름 또는 수요처명 검색"
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
          <button
            className={rowActionBtnClass}
            onClick={handleBulkDropButtonClick}
          >
            일괄 참여종료
          </button>
          <button
            className={rowActionBtnClass}
            onClick={handleBulkReactivateButtonClick}
          >
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
              <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                전화번호
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
                    onChange={() =>
                      handleParticipantSelectionChange(participant.id)
                    }
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
                  {participant.phoneLast4}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  <FilterSelect
                    value={String(participant.groupId ?? "")}
                    onChange={(value) =>
                      handleGroupSelectChange(participant.id, value)
                    }
                    options={[
                      { value: "", label: "미배정" },
                      ...groups
                        .filter(
                          (group) =>
                            group.isActive || group.id === participant.groupId,
                        )
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
                        onClick={() =>
                          handleLeaveButtonClick(
                            participant.id,
                            participant.name,
                          )
                        }
                      >
                        휴무
                      </button>
                      <button
                        className={rowActionBtnClass}
                        onClick={() =>
                          handleAnnualSettingButtonClick(
                            participant.id,
                            participant.name,
                          )
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
                        onClick={() =>
                          handleDropButtonClick(
                            participant.id,
                            participant.name,
                          )
                        }
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
                      onClick={() =>
                        handleReactivateButtonClick(
                          participant.id,
                          participant.name,
                        )
                      }
                    >
                      재활성화
                    </button>
                  )}
                  <button
                    className={rowActionBtnClass}
                    onClick={() =>
                      handleDeleteButtonClick(participant.id, participant.name)
                    }
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
          onSaved={() => {
            setLeaveModalOpen(false);
            onChanged();
          }}
          target={leaveTarget}
        />
      )}

      {annualModalOpen && (
        <AnnualLeaveModal
          onClose={() => setAnnualModalOpen(false)}
          onSaved={onChanged}
          target={annualTarget}
        />
      )}

      {scheduleTarget && (
        <ParticipantMonthlyScheduleModal
          participant={scheduleTarget}
          group={groups.find((group) => group.id === scheduleTarget.groupId)}
          onClose={() => setScheduleTarget(null)}
          onSaved={() => {
            setScheduleTarget(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
};

export default ProgramParticipantsSection;
