import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { moveParticipantToDemandSiteMutationOptions } from "../../api/admin/participants";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { useToast } from "../../context/useToast";
import Button from "../../components/Button";
import type { DemandSite, Participant } from "../../types";

interface ParticipantDemandSiteAssignModalProps {
  onClose: () => void;
  participant: Participant;
  programId: number;
  demandSites: DemandSite[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 참여자의 수요처를 배정하는 모달입니다.
 */
const ParticipantDemandSiteAssignModal = ({
  onClose,
  participant,
  programId,
  demandSites,
}: ParticipantDemandSiteAssignModalProps) => {
  const [demandSiteId, setDemandSiteId] = useState(String(participant.demandSiteId ?? ""));
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const moveParticipantToDemandSiteMutation = useMutation(
    moveParticipantToDemandSiteMutationOptions(queryClient),
  );

  const handleChangeButtonClick = () => {
    if (!demandSiteId) {
      alert("수요처를 선택해주세요.");
      return;
    }
    moveParticipantToDemandSiteMutation.mutate(
      { participantId: participant.id, programId, demandSiteId: Number(demandSiteId) },
      {
        onSuccess: () => {
          showToast("수요처가 변경되었습니다.");
          onClose();
        },
        onError: (error) =>
          alert(error instanceof Error ? error.message : "수요처 배정에 실패했습니다."),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-[rgba(15,23,32,0.45)] z-[2000] flex items-center justify-center">
      <div className="bg-white rounded-[8px] shadow-xl w-[380px] p-5">
        <div className="text-[14px] font-bold mb-4">{participant.name} — 수요처 배정</div>

        <FormField label="배정할 수요처">
          {/* isActive(조 스케줄 배정 여부)는 참여자 직접 배정과 무관해 필터하지 않는다 */}
          <FilterSelect
            className="w-full"
            value={demandSiteId}
            onChange={setDemandSiteId}
            options={[
              { value: "", label: "선택하세요" },
              ...demandSites.map((demandSite) => ({
                value: String(demandSite.id),
                label: demandSite.name,
              })),
            ]}
          />
        </FormField>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={handleChangeButtonClick}>변경</Button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantDemandSiteAssignModal;
