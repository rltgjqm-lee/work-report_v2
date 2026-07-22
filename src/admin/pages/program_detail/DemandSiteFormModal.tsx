import { useState } from "react";

import {
  createDemandSite,
  updateDemandSite,
} from "../../api/admin/demandSites";
import SlideModal from "../../components/SlideModal";
import FormField from "../../components/FormField";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { DemandSite } from "../../types";

const emptyForm = {
  name: "",
  baseLat: "",
  baseLng: "",
  allowedRadius: "1500",
  address: "",
  contactPerson: "",
};

interface DemandSiteFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  programId: number;
  editingDemandSite: DemandSite | null;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 수요처를 추가/수정하는 모달입니다.
 *
 */
// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 아래 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const DemandSiteFormModal = ({
  onClose,
  onSaved,
  programId,
  editingDemandSite,
}: DemandSiteFormModalProps) => {
  const [form, setForm] = useState(
    editingDemandSite
      ? {
          name: editingDemandSite.name,
          baseLat: String(editingDemandSite.baseLat),
          baseLng: String(editingDemandSite.baseLng),
          allowedRadius: String(editingDemandSite.allowedRadius),
          address: editingDemandSite.address ?? "",
          contactPerson: editingDemandSite.contactPerson ?? "",
        }
      : emptyForm,
  );

  const handleSaveButtonClick = async () => {
    if (!form.name || !form.baseLat || !form.baseLng) {
      alert("수요처명과 위도/경도를 입력해주세요.");

      return;
    }
    try {
      const payload = {
        name: form.name,
        baseLat: Number(form.baseLat),
        baseLng: Number(form.baseLng),
        allowedRadius: Number(form.allowedRadius) || undefined,
        address: form.address || undefined,
        contactPerson: form.contactPerson || undefined,
      };
      if (editingDemandSite) {
        await updateDemandSite(editingDemandSite.id, payload);
      } else {
        await createDemandSite({ programId, ...payload });
      }
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title={editingDemandSite ? "수요처 수정" : "수요처 추가"}
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
      <FormField label="수요처명">
        <input
          className={inputClass}
          value={form.name}
          onChange={(event) =>
            setForm((f) => ({ ...f, name: event.target.value }))
          }
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="위도">
            <input
              type="number"
              step="any"
              className={inputClass}
              value={form.baseLat}
              onChange={(event) =>
                setForm((f) => ({ ...f, baseLat: event.target.value }))
              }
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="경도">
            <input
              type="number"
              step="any"
              className={inputClass}
              value={form.baseLng}
              onChange={(event) =>
                setForm((f) => ({ ...f, baseLng: event.target.value }))
              }
            />
          </FormField>
        </div>
      </div>
      <FormField label="반경(m)">
        <input
          type="number"
          className={inputClass}
          value={form.allowedRadius}
          onChange={(event) =>
            setForm((f) => ({ ...f, allowedRadius: event.target.value }))
          }
        />
      </FormField>
      <FormField label="주소">
        <input
          className={inputClass}
          value={form.address}
          onChange={(event) =>
            setForm((f) => ({ ...f, address: event.target.value }))
          }
        />
      </FormField>
      <FormField label="담당자">
        <input
          className={inputClass}
          value={form.contactPerson}
          onChange={(event) =>
            setForm((f) => ({ ...f, contactPerson: event.target.value }))
          }
        />
      </FormField>
    </SlideModal>
  );
};

export default DemandSiteFormModal;
