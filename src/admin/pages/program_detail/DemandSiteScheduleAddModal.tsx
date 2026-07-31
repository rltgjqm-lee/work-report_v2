import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createDemandSiteScheduleMutationOptions } from "../../api/admin/demandSites";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { Group } from "../../types";

const emptyForm = {
  groupId: "",
  shiftStart: "",
  shiftEnd: "",
};

interface DemandSiteScheduleAddModalProps {
  onClose: () => void;
  targetSiteId: number | null;
  activeGroups: Group[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 수요처 근무시간을 추가하는 모달입니다.
 *
 */
const DemandSiteScheduleAddModal = ({
  onClose,
  targetSiteId,
  activeGroups,
}: DemandSiteScheduleAddModalProps) => {
  const [form, setForm] = useState(emptyForm);

  const queryClient = useQueryClient();
  const createDemandSiteScheduleMutation = useMutation(
    createDemandSiteScheduleMutationOptions(queryClient),
  );

  const handleSaveButtonClick = () => {
    if (!targetSiteId || !form.groupId || !form.shiftStart || !form.shiftEnd) {
      alert("조와 근무시간을 입력해주세요.");

      return;
    }
    createDemandSiteScheduleMutation.mutate(
      {
        demandSiteId: targetSiteId,
        data: {
          groupId: Number(form.groupId),
          shiftStart: form.shiftStart,
          shiftEnd: form.shiftEnd,
        },
      },
      {
        onSuccess: () => onClose(),
        onError: (error) => alert(error instanceof Error ? error.message : "등록에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title="근무시간 추가"
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
      <FormField label="조">
        <FilterSelect
          className="w-full"
          value={form.groupId}
          onChange={(value) => setForm((f) => ({ ...f, groupId: value }))}
          options={[
            { value: "", label: "선택하세요" },
            ...activeGroups.map((group) => ({
              value: String(group.id),
              label: group.name,
            })),
          ]}
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="시작시간">
            <input
              type="time"
              step={600}
              className={inputClass}
              value={form.shiftStart}
              onChange={(event) => setForm((f) => ({ ...f, shiftStart: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="종료시간">
            <input
              type="time"
              step={600}
              className={inputClass}
              value={form.shiftEnd}
              onChange={(event) => setForm((f) => ({ ...f, shiftEnd: event.target.value }))}
            />
          </FormField>
        </div>
      </div>
    </SlideModal>
  );
};

export default DemandSiteScheduleAddModal;
