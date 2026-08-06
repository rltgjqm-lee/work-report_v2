import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDemandSiteScheduleMutationOptions,
  deleteDemandSiteScheduleMutationOptions,
  demandSiteSchedulesQueryOptions,
} from "../../api/admin/demandSites";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { useToast } from "../../context/useToast";
import { btnGhostClass, btnPrimaryClass } from "../../uiClasses";
import type { DemandSite, Group } from "../../types";

interface DemandSiteGroupAssignModalProps {
  onClose: () => void;
  demandSite: DemandSite;
  activeGroups: Group[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 수요처에 배치할 조를 관리하는 모달입니다.
 * 근무시간은 조 자체 값(groups.shiftStart/shiftEnd)을 그대로 보여주기만 한다.
 * 조를 고르거나 빼는 건 로컬에서만 반영되고, "저장"을 눌러야 실제로 등록/삭제된다.
 */
const DemandSiteGroupAssignModal = ({
  onClose,
  demandSite,
  activeGroups,
}: DemandSiteGroupAssignModalProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: schedules = [], isSuccess: schedulesLoaded } = useQuery(
    demandSiteSchedulesQueryOptions(demandSite.id),
  );
  const createDemandSiteScheduleMutation = useMutation(
    createDemandSiteScheduleMutationOptions(queryClient),
  );
  const deleteDemandSiteScheduleMutation = useMutation(
    deleteDemandSiteScheduleMutationOptions(queryClient),
  );

  const [stagedGroupIds, setStagedGroupIds] = useState<number[]>([]);

  useEffect(() => {
    if (schedulesLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 조회된 초기값을 편집 가능한 로컬 상태로 동기화
      setStagedGroupIds(schedules.map((schedule) => schedule.groupId));
    }
  }, [schedulesLoaded, schedules]);

  const handleGroupSelectChange = (groupId: string) => {
    if (!groupId) return;

    setStagedGroupIds((current) => [...current, Number(groupId)]);
  };

  const handleRemoveButtonClick = (groupId: number) => {
    setStagedGroupIds((current) => current.filter((id) => id !== groupId));
  };

  const findGroupDisplay = (groupId: number) => {
    const activeGroup = activeGroups.find((group) => group.id === groupId);
    if (activeGroup) {
      return {
        name: activeGroup.name,
        shiftStart: activeGroup.shiftStart,
        shiftEnd: activeGroup.shiftEnd,
      };
    }
    // 배정된 뒤 비활성화된 조는 activeGroups엔 없으니, 저장된 스케줄 쪽 값으로 대신 보여준다.
    const schedule = schedules.find((schedule) => schedule.groupId === groupId);
    return schedule
      ? { name: schedule.groupName, shiftStart: schedule.shiftStart, shiftEnd: schedule.shiftEnd }
      : null;
  };

  const handleSaveButtonClick = async () => {
    const originalGroupIds = schedules.map((schedule) => schedule.groupId);
    const toAdd = stagedGroupIds.filter((groupId) => !originalGroupIds.includes(groupId));
    const toRemove = schedules.filter((schedule) => !stagedGroupIds.includes(schedule.groupId));

    try {
      await Promise.all([
        ...toAdd.map((groupId) =>
          createDemandSiteScheduleMutation.mutateAsync({
            demandSiteId: demandSite.id,
            data: { groupId },
          }),
        ),
        ...toRemove.map((schedule) =>
          deleteDemandSiteScheduleMutation.mutateAsync({
            scheduleId: schedule.id,
            demandSiteId: demandSite.id,
          }),
        ),
      ]);
      showToast("배치된 조를 저장했습니다.");
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title={`${demandSite.name} — 조 배정`}
      onClose={onClose}
      footer={
        <>
          <button className={btnGhostClass} onClick={onClose}>
            취소
          </button>
          <button className={btnPrimaryClass} onClick={handleSaveButtonClick}>
            저장
          </button>
        </>
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
              .filter((group) => !stagedGroupIds.includes(group.id))
              .map((group) => ({ value: String(group.id), label: group.name })),
          ]}
        />
      </FormField>

      <FormField label="배치된 조">
        {stagedGroupIds.length === 0 ? (
          <p className="text-[12.5px] text-[#9aa1ab]">아직 배치된 조가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {stagedGroupIds.map((groupId) => {
              const display = findGroupDisplay(groupId);
              if (!display) return null;

              return (
                <li
                  key={groupId}
                  className="flex items-center justify-between gap-2 text-[13px] px-3 py-2 border border-[#e2e5eb] rounded-[2px]"
                >
                  <span>
                    {display.name}{" "}
                    <span className="text-[#8b94a3]">
                      ({display.shiftStart}~{display.shiftEnd})
                    </span>
                  </span>
                  <button
                    className="bg-transparent border-none text-[12px] font-semibold text-[#c0392b] cursor-pointer hover:underline"
                    onClick={() => handleRemoveButtonClick(groupId)}
                  >
                    삭제
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </FormField>
    </SlideModal>
  );
};

export default DemandSiteGroupAssignModal;
