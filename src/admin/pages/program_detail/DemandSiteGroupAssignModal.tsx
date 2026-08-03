import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDemandSiteScheduleMutationOptions,
  deleteDemandSiteScheduleMutationOptions,
  demandSiteSchedulesQueryOptions,
} from "../../api/admin/demandSites";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass } from "../../uiClasses";
import type { DemandSite, Group } from "../../types";

interface DemandSiteGroupAssignModalProps {
  onClose: () => void;
  demandSite: DemandSite;
  activeGroups: Group[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 수요처에 배치할 조를 관리하는 모달입니다.
 * 근무시간은 조 자체 값(groups.shiftStart/shiftEnd)을 그대로 보여주기만 한다.
 */
const DemandSiteGroupAssignModal = ({
  onClose,
  demandSite,
  activeGroups,
}: DemandSiteGroupAssignModalProps) => {
  const queryClient = useQueryClient();

  const { data: schedules = [] } = useQuery(demandSiteSchedulesQueryOptions(demandSite.id));
  const createDemandSiteScheduleMutation = useMutation(
    createDemandSiteScheduleMutationOptions(queryClient),
  );
  const deleteDemandSiteScheduleMutation = useMutation(
    deleteDemandSiteScheduleMutationOptions(queryClient),
  );

  const handleGroupSelectChange = (groupId: string) => {
    if (!groupId) return;

    createDemandSiteScheduleMutation.mutate(
      { demandSiteId: demandSite.id, data: { groupId: Number(groupId) } },
      {
        onError: (error) => alert(error instanceof Error ? error.message : "등록에 실패했습니다."),
      },
    );
  };

  const handleDeleteButtonClick = (scheduleId: number) => {
    if (!confirm("이 조 배치를 삭제하시겠습니까?")) return;

    deleteDemandSiteScheduleMutation.mutate(
      { scheduleId, demandSiteId: demandSite.id },
      {
        onError: (error) => alert(error instanceof Error ? error.message : "삭제에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title={`${demandSite.name} — 조 배정`}
      onClose={onClose}
      footer={
        <button className={btnGhostClass} onClick={onClose}>
          닫기
        </button>
      }
    >
      <FormField label="배치할 조">
        <FilterSelect
          className="w-full"
          value=""
          onChange={handleGroupSelectChange}
          options={[
            { value: "", label: "선택하세요" },
            ...activeGroups
              .filter((group) => !schedules.some((schedule) => schedule.groupId === group.id))
              .map((group) => ({ value: String(group.id), label: group.name })),
          ]}
        />
      </FormField>

      <FormField label="배치된 조">
        {schedules.length === 0 ? (
          <p className="text-[12.5px] text-[#9aa1ab]">아직 배치된 조가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {schedules.map((schedule) => (
              <li
                key={schedule.id}
                className="flex items-center justify-between gap-2 text-[13px] px-3 py-2 border border-[#e2e5eb] rounded-[2px]"
              >
                <span>
                  {schedule.groupName}{" "}
                  <span className="text-[#8b94a3]">
                    ({schedule.shiftStart}~{schedule.shiftEnd})
                  </span>
                </span>
                <button
                  className="bg-transparent border-none text-[12px] font-semibold text-[#c0392b] cursor-pointer hover:underline"
                  onClick={() => handleDeleteButtonClick(schedule.id)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </FormField>
    </SlideModal>
  );
};

export default DemandSiteGroupAssignModal;
