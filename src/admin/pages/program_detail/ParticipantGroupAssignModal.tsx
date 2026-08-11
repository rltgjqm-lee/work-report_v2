import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteParticipantGroupOverrideMutationOptions,
  moveParticipantToGroupMutationOptions,
  participantGroupOverridesQueryOptions,
  setParticipantGroupOverrideMutationOptions,
} from "../../api/admin/participants";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { useToast } from "../../context/useToast";
import Button from "../../components/Button";
import Input from "../../components/Input";
import { rowActionBtnClass } from "../../uiClasses";
import { getLocalToday } from "../../../utils/timeFormat";
import type { Group, Participant } from "../../types";

type AssignMode = "TEMPORARY" | "PERMANENT";

interface ParticipantGroupAssignModalProps {
  onClose: () => void;
  participant: Participant;
  programId: number;
  groups: Group[];
}

const modeButtonClass = (isSelected: boolean) =>
  isSelected
    ? "px-3 py-1.5 rounded-[2px] text-[13px] font-semibold bg-admin-brand text-white"
    : "px-3 py-1.5 rounded-[2px] text-[13px] font-semibold bg-surface-page text-text-subtle";

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 참여자의 조를 배정하는 모달입니다.
 * "하루만 변경"은 특정 날짜만 다른 조로 취급하고(원래 조는 유지, 다음날 자동 복귀),
 * "계속 이 조로 변경"은 participants.groupId 자체를 바꾸는 영구 변경입니다.
 */
const ParticipantGroupAssignModal = ({
  onClose,
  participant,
  programId,
  groups,
}: ParticipantGroupAssignModalProps) => {
  const [mode, setMode] = useState<AssignMode>("TEMPORARY");
  const [date, setDate] = useState(getLocalToday);
  const [temporaryGroupId, setTemporaryGroupId] = useState("");
  const [permanentGroupId, setPermanentGroupId] = useState(String(participant.groupId ?? ""));
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: overrides = [], isFetching: isOverridesFetching } = useQuery({
    ...participantGroupOverridesQueryOptions(participant.id),
    enabled: mode === "TEMPORARY",
  });

  const setOverrideMutation = useMutation(setParticipantGroupOverrideMutationOptions(queryClient));
  const deleteOverrideMutation = useMutation(
    deleteParticipantGroupOverrideMutationOptions(queryClient),
  );
  const moveParticipantToGroupMutation = useMutation(
    moveParticipantToGroupMutationOptions(queryClient),
  );

  const temporaryGroupOptions = groups.filter((group) => group.isActive);
  const permanentGroupOptions = groups.filter(
    (group) => group.isActive || group.id === participant.groupId,
  );

  const handleAddOverrideButtonClick = () => {
    if (!date || !temporaryGroupId) {
      alert("날짜와 조를 모두 선택해주세요.");
      return;
    }
    setOverrideMutation.mutate(
      { participantId: participant.id, date, groupId: Number(temporaryGroupId) },
      {
        onSuccess: () => {
          showToast("임시 배정을 등록했습니다.");
          setTemporaryGroupId("");
        },
        onError: (error) => alert(error instanceof Error ? error.message : "등록에 실패했습니다."),
      },
    );
  };

  const handleDeleteOverrideButtonClick = (overrideDate: string) => {
    if (!confirm(`${overrideDate} 임시 배정을 삭제하시겠습니까?`)) return;
    deleteOverrideMutation.mutate(
      { participantId: participant.id, date: overrideDate },
      {
        onSuccess: () => showToast("임시 배정을 삭제했습니다."),
        onError: (error) => alert(error instanceof Error ? error.message : "삭제에 실패했습니다."),
      },
    );
  };

  const handlePermanentChangeButtonClick = () => {
    if (!permanentGroupId) {
      alert("조를 선택해주세요.");
      return;
    }
    moveParticipantToGroupMutation.mutate(
      { participantId: participant.id, programId, groupId: Number(permanentGroupId) },
      {
        onSuccess: () => {
          showToast("조가 변경되었습니다.");
          onClose();
        },
        onError: (error) =>
          alert(error instanceof Error ? error.message : "조 배정에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title={`${participant.name} — 조 배정`}
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <FormField label="변경 방식">
        <div className="flex gap-2">
          <button
            className={modeButtonClass(mode === "TEMPORARY")}
            onClick={() => setMode("TEMPORARY")}
          >
            하루만 변경
          </button>
          <button
            className={modeButtonClass(mode === "PERMANENT")}
            onClick={() => setMode("PERMANENT")}
          >
            계속 이 조로 변경
          </button>
        </div>
      </FormField>

      {mode === "TEMPORARY" ? (
        <>
          <div className="text-[13px] text-text-subtle">
            선택한 날짜 하루만 다른 조로 취급합니다. 다음날부터는 원래 조로 자동 복귀합니다.
          </div>

          <FormField label="날짜">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </FormField>

          <FormField label="임시 배정할 조">
            <FilterSelect
              className="w-full"
              value={temporaryGroupId}
              onChange={setTemporaryGroupId}
              options={[
                { value: "", label: "선택하세요" },
                ...temporaryGroupOptions.map((group) => ({
                  value: String(group.id),
                  label: group.name,
                })),
              ]}
            />
          </FormField>

          <Button onClick={handleAddOverrideButtonClick}>등록</Button>

          <FormField label="등록된 임시 배정">
            {isOverridesFetching ? (
              <div className="text-[13px] text-admin-text-placeholder py-2">불러오는 중...</div>
            ) : overrides.length === 0 ? (
              <div className="text-[13px] text-admin-text-placeholder py-2">
                등록된 임시 배정이 없습니다.
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {overrides.map(({ override, groupName }) => (
                  <li
                    key={override.id}
                    className="flex items-center justify-between gap-2 text-[13px] px-3 py-2 border border-admin-border-subtle rounded-[2px]"
                  >
                    <span>
                      {override.date} → <b className="font-semibold">{groupName}</b>
                    </span>
                    <button
                      className={rowActionBtnClass}
                      onClick={() => handleDeleteOverrideButtonClick(override.date)}
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </FormField>
        </>
      ) : (
        <>
          <div className="text-[13px] text-text-subtle">
            사업단 운영이 끝날 때까지(다시 바꾸기 전까지) 계속 이 조로 배정됩니다.
          </div>

          <FormField label="배정할 조">
            <FilterSelect
              className="w-full"
              value={permanentGroupId}
              onChange={setPermanentGroupId}
              options={[
                { value: "", label: "선택하세요" },
                ...permanentGroupOptions.map((group) => ({
                  value: String(group.id),
                  label: group.name,
                })),
              ]}
            />
          </FormField>

          <Button onClick={handlePermanentChangeButtonClick}>변경</Button>
        </>
      )}
    </SlideModal>
  );
};

export default ParticipantGroupAssignModal;
