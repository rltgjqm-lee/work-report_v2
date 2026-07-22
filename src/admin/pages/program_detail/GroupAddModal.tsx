import { useState } from "react";

import { createGroup } from "../../api/admin/groups";
import SlideModal from "../../components/SlideModal";
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
  onSaved: () => void;
  programId: number;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 조를 추가하는 모달입니다.
 *
 */
// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const GroupAddModal = ({ onClose, onSaved, programId }: GroupAddModalProps) => {
  const [form, setForm] = useState(emptyForm);

  const handleSaveButtonClick = async () => {
    if (!form.name || !form.shiftStart || !form.shiftEnd) {
      alert("조 이름과 근무시간을 입력해주세요.");

      return;
    }
    try {
      await createGroup(programId, form);
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : "조 등록에 실패했습니다.");
    }
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
          onChange={(event) =>
            setForm((f) => ({ ...f, name: event.target.value }))
          }
        />
      </FormField>
      <FormField label="설명">
        <input
          className={inputClass}
          value={form.description}
          onChange={(event) =>
            setForm((f) => ({ ...f, description: event.target.value }))
          }
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="근무 시작시간">
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
          <FormField label="근무 종료시간">
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

export default GroupAddModal;
