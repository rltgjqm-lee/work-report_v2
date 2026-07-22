import { useState } from "react";

import { createDemandSiteSchedule } from "../../api/admin/demandSites";
import SlideModal from "../../components/SlideModal";
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
  onSaved: () => void;
  targetSiteId: number | null;
  activeGroups: Group[];
}

// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const DemandSiteScheduleAddModal = ({
  onClose,
  onSaved,
  targetSiteId,
  activeGroups,
}: DemandSiteScheduleAddModalProps) => {
  const [form, setForm] = useState(emptyForm);

  const handleSaveButtonClick = async () => {
    if (!targetSiteId || !form.groupId || !form.shiftStart || !form.shiftEnd) {
      alert("조와 근무시간을 입력해주세요.");

      return;
    }
    try {
      await createDemandSiteSchedule(targetSiteId, {
        groupId: Number(form.groupId),
        shiftStart: form.shiftStart,
        shiftEnd: form.shiftEnd,
      });
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : "등록에 실패했습니다.");
    }
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
              className={inputClass}
              value={form.shiftStart}
              onChange={(event) =>
                setForm((f) => ({ ...f, shiftStart: event.target.value }))
              }
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="종료시간">
            <input
              type="time"
              className={inputClass}
              value={form.shiftEnd}
              onChange={(event) =>
                setForm((f) => ({ ...f, shiftEnd: event.target.value }))
              }
            />
          </FormField>
        </div>
      </div>
    </SlideModal>
  );
};

export default DemandSiteScheduleAddModal;
