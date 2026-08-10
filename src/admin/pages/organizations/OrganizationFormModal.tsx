import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createOrganizationMutationOptions,
  updateOrganizationMutationOptions,
} from "../../api/admin/organizations";
import { loadDaumPostcodeScript } from "../../utils/loadDaumPostcode";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { useToast } from "../../context/useToast";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import { KOREAN_REGIONS, SIDO_LIST } from "../../data/koreanRegions";
import { ORGANIZATION_TYPES } from "../../data/organizationTypes";
import type { Organization } from "../../types";

// 휴대폰(010-1234-5678), 유선(02-123-4567, 031-123-4567 등 지역번호 1~2자리),
// 안심번호(0507-1234-5678, 4자리)까지 폭넓게 허용하는 느슨한 패턴. 맨 앞 0을 반드시
// 포함해야 하고(국내 전화번호는 전부 0으로 시작), 문자열 그대로 비교하므로
// Number() 변환처럼 앞자리 0이 사라질 걱정이 없다.
const PHONE_NUMBER_PATTERN = /^0\d{1,3}-\d{3,4}-\d{4}$/;

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
  editingOrganization: Organization | null;
}

/**
 * 관리자 페이지 > 기관 관리 페이지에서 기관을 추가/수정하는 모달입니다.
 *
 */
const OrganizationFormModal = ({ onClose, editingOrganization }: OrganizationFormModalProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const createOrganizationMutation = useMutation(createOrganizationMutationOptions(queryClient));
  const updateOrganizationMutation = useMutation(updateOrganizationMutationOptions(queryClient));
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

  const handleSearchAddressButtonClick = async () => {
    try {
      await loadDaumPostcodeScript();
      new window.daum!.Postcode({
        oncomplete: (data) => {
          setForm((form) => ({
            ...form,
            address: data.roadAddress || data.jibunAddress,
          }));
        },
      }).open();
    } catch (error) {
      setError(error instanceof Error ? error.message : "주소 검색을 열 수 없습니다.");
    }
  };

  const handleSaveButtonClick = () => {
    if (form.phone && !PHONE_NUMBER_PATTERN.test(form.phone)) {
      setError("전화번호 형식이 올바르지 않습니다. 예: 02-1234-5678");

      return;
    }
    if (form.fax && !PHONE_NUMBER_PATTERN.test(form.fax)) {
      setError("팩스번호 형식이 올바르지 않습니다. 예: 02-1234-5678");

      return;
    }

    const saveCallbacks = {
      onSuccess: () => {
        showToast(editingOrganization ? "기관 정보를 수정했습니다." : "기관을 추가했습니다.");
        onClose();
      },
      onError: (error: unknown) =>
        setError(error instanceof Error ? error.message : "저장에 실패했습니다."),
    };

    if (editingOrganization) {
      updateOrganizationMutation.mutate({ id: editingOrganization.id, data: form }, saveCallbacks);
    } else {
      createOrganizationMutation.mutate(form, saveCallbacks);
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
          onChange={(event) => setForm((form) => ({ ...form, name: event.target.value }))}
        />
      </FormField>
      <FormField label="기관주소">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={form.address}
            readOnly
            placeholder="주소 검색을 눌러 입력해주세요"
            onClick={handleSearchAddressButtonClick}
          />
          <button type="button" className={btnGhostClass} onClick={handleSearchAddressButtonClick}>
            주소 검색
          </button>
        </div>
      </FormField>
      <FormField label="대표자">
        <input
          className={inputClass}
          value={form.rep}
          onChange={(event) => setForm((form) => ({ ...form, rep: event.target.value }))}
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="전화번호">
            <input
              className={inputClass}
              placeholder="02-1234-5678"
              value={form.phone}
              onChange={(event) => setForm((form) => ({ ...form, phone: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="팩스번호">
            <input
              className={inputClass}
              placeholder="02-1234-5678"
              value={form.fax}
              onChange={(event) => setForm((form) => ({ ...form, fax: event.target.value }))}
            />
          </FormField>
        </div>
      </div>
      <FormField label="사업자 등록번호">
        <input
          className={inputClass}
          value={form.bizNo}
          onChange={(event) => setForm((form) => ({ ...form, bizNo: event.target.value }))}
        />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="시/도 (재난문자 지역 매칭용)">
            <FilterSelect
              className="w-full"
              value={form.regionSido}
              onChange={(value) =>
                setForm((form) => ({
                  ...form,
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
              onChange={(value) => setForm((form) => ({ ...form, regionSigungu: value }))}
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
            <FilterSelect
              className="w-full"
              value={form.organizationType}
              onChange={(value) => setForm((form) => ({ ...form, organizationType: value }))}
              options={[
                { value: "", label: "선택하세요" },
                ...ORGANIZATION_TYPES.map((type) => ({ value: type.value, label: type.label })),
              ]}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="사업연도">
            <input
              className={inputClass}
              placeholder="예: 2026"
              value={form.prjYear}
              onChange={(event) => setForm((form) => ({ ...form, prjYear: event.target.value }))}
            />
          </FormField>
        </div>
      </div>
      {error && <p className="text-[12.5px] text-admin-error-text">{error}</p>}
    </SlideModal>
  );
};

export default OrganizationFormModal;
