import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createGroupMutationOptions } from "../../api/admin/groups";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";

const emptyForm = {
  name: "",
  description: "",
  shiftStart: "",
  shiftEnd: "",
};

interface GroupAddModalProps {
  onClose: () => void;
  programId: number;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 조를 추가하는 모달입니다.
 *
 */
const GroupAddModal = ({ onClose, programId }: GroupAddModalProps) => {
  const [form, setForm] = useState(emptyForm);

  const queryClient = useQueryClient();
  const createGroupMutation = useMutation(createGroupMutationOptions(queryClient));

  const handleSaveButtonClick = () => {
    if (!form.name || !form.shiftStart || !form.shiftEnd) {
      alert("조 이름과 근무시간을 입력해주세요.");
      return;
    }

    createGroupMutation.mutate(
      { programId, data: form },
      {
        onSuccess: () => onClose(),
        onError: (error) =>
          alert(error instanceof Error ? error.message : "조 등록에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title="조 추가"
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
      <FormField label="조 이름">
        <input
          className={inputClass}
          value={form.name}
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
        />
      </FormField>
      <FormField label="설명">
        <input
          className={inputClass}
          value={form.description}
          onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="근무 시작시간">
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
          <FormField label="근무 종료시간">
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

export default GroupAddModal;
