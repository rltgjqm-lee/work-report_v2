import { useState } from "react";

import {
  createOrganization,
  updateOrganization,
} from "../../api/admin/organizations";
import SlideModal from "../SlideModal";
import FormField from "../FormField";
import FilterSelect from "../FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import { KOREAN_REGIONS, SIDO_LIST } from "../../data/koreanRegions";
import type { Organization } from "../../types";

const emptyForm = {
  name: "",
  address: "",
  rep: "",
  phone: "",
  fax: "",
  bizNo: "",
  regionSido: "",
  regionSigungu: "",
  organizationType: "",
  prjYear: "",
};

interface OrganizationFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  editingOrganization: Organization | null;
}

// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 아래 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const OrganizationFormModal = ({
  onClose,
  onSaved,
  editingOrganization,
}: OrganizationFormModalProps) => {
  const [form, setForm] = useState(
    editingOrganization
      ? {
          name: editingOrganization.name,
          address: editingOrganization.address ?? "",
          rep: editingOrganization.rep ?? "",
          phone: editingOrganization.phone ?? "",
          fax: editingOrganization.fax ?? "",
          bizNo: editingOrganization.bizNo ?? "",
          regionSido: editingOrganization.regionSido ?? "",
          regionSigungu: editingOrganization.regionSigungu ?? "",
          organizationType: editingOrganization.organizationType ?? "",
          prjYear: editingOrganization.prjYear ?? "",
        }
      : emptyForm,
  );
  const [error, setError] = useState<string | null>(null);

  const handleSaveButtonClick = async () => {
    try {
      if (editingOrganization) {
        await updateOrganization(editingOrganization.id, form);
      } else {
        await createOrganization(form);
      }
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title={editingOrganization ? "기관 정보 수정" : "기관 추가"}
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
      <FormField label="기관명">
        <input
          className={inputClass}
          value={form.name}
          onChange={(event) =>
            setForm((f) => ({ ...f, name: event.target.value }))
          }
        />
      </FormField>
      <FormField label="기관주소">
        <input
          className={inputClass}
          value={form.address}
          onChange={(event) =>
            setForm((f) => ({ ...f, address: event.target.value }))
          }
        />
      </FormField>
      <FormField label="대표자">
        <input
          className={inputClass}
          value={form.rep}
          onChange={(event) =>
            setForm((f) => ({ ...f, rep: event.target.value }))
          }
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="전화번호">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(event) =>
                setForm((f) => ({ ...f, phone: event.target.value }))
              }
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="팩스번호">
            <input
              className={inputClass}
              value={form.fax}
              onChange={(event) =>
                setForm((f) => ({ ...f, fax: event.target.value }))
              }
            />
          </FormField>
        </div>
      </div>
      <FormField label="사업자 등록번호">
        <input
          className={inputClass}
          value={form.bizNo}
          onChange={(event) =>
            setForm((f) => ({ ...f, bizNo: event.target.value }))
          }
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="시/도 (재난문자 지역 매칭용)">
            <FilterSelect
              className="w-full"
              value={form.regionSido}
              onChange={(value) =>
                setForm((f) => ({
                  ...f,
                  regionSido: value,
                  regionSigungu: "",
                }))
              }
              options={[
                { value: "", label: "선택하세요" },
                ...SIDO_LIST.map((sido) => ({ value: sido, label: sido })),
              ]}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="시/군/구">
            <FilterSelect
              className="w-full"
              value={form.regionSigungu}
              disabled={!form.regionSido}
              onChange={(value) =>
                setForm((f) => ({ ...f, regionSigungu: value }))
              }
              options={[
                { value: "", label: "선택하세요" },
                ...(KOREAN_REGIONS[form.regionSido] ?? []).map((sigungu) => ({
                  value: sigungu,
                  label: sigungu,
                })),
              ]}
            />
          </FormField>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="기관유형">
            <input
              className={inputClass}
              placeholder="예: 시니어클럽, 노인복지관"
              value={form.organizationType}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  organizationType: event.target.value,
                }))
              }
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="사업연도">
            <input
              className={inputClass}
              placeholder="예: 2026"
              value={form.prjYear}
              onChange={(event) =>
                setForm((f) => ({ ...f, prjYear: event.target.value }))
              }
            />
          </FormField>
        </div>
      </div>
      {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
    </SlideModal>
  );
};

export default OrganizationFormModal;
