import { useState } from "react";

import {
  createDemandSite,
  updateDemandSite,
} from "../../api/admin/demandSites";
import { loadDaumPostcodeScript } from "../../utils/loadDaumPostcode";
import SlideModal from "../../components/SlideModal";
import FormField from "../../components/FormField";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { DemandSite } from "../../types";

const emptyForm = {
  name: "",
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
 * 관리자 페이지 > 사업단 상세 페이지에서 수요처(마스터 정보)를 추가/수정하는 모달입니다.
 * 실제 위경도/반경/다각형 관제구역은 여기가 아니라 "거점 관리" 편집기에서 다룬다.
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
          address: editingDemandSite.address ?? "",
          contactPerson: editingDemandSite.contactPerson ?? "",
        }
      : emptyForm,
  );

  const handleSearchAddressButtonClick = async () => {
    try {
      await loadDaumPostcodeScript();
      new window.daum!.Postcode({
        oncomplete: (data) => {
          setForm((f) => ({
            ...f,
            address: data.roadAddress || data.jibunAddress,
          }));
        },
      }).open();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "주소 검색을 열 수 없습니다.",
      );
    }
  };

  const handleSaveButtonClick = async () => {
    if (!form.name) {
      alert("수요처명을 입력해주세요.");

      return;
    }
    try {
      const payload = {
        name: form.name,
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
      <FormField label="주소">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={form.address}
            readOnly
            placeholder="주소 검색을 눌러 입력해주세요"
            onClick={handleSearchAddressButtonClick}
          />
          <button
            type="button"
            className={btnGhostClass}
            onClick={handleSearchAddressButtonClick}
          >
            주소 검색
          </button>
        </div>
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
