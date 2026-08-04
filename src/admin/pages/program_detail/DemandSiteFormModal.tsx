import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignableDemandSiteAdminsQueryOptions,
  createDemandSiteMutationOptions,
  updateDemandSiteMutationOptions,
} from "../../api/admin/demandSites";
import { loadDaumPostcodeScript } from "../../utils/loadDaumPostcode";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
// import FilterSelect from "../../components/FilterSelect"; // 담당자 지정 UI와 함께 임시로 뺐다
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { DemandSite } from "../../types";

// GPS 오차를 감안한 최소 반경 — 서버(demandSites 라우트)에서도 같은 값으로 올려잡는다
const MIN_RADIUS_METERS = 1500;

const emptyForm = {
  name: "",
  address: "",
  contactAdminId: "",
  radius: String(MIN_RADIUS_METERS),
  baseAreaEnabled: true,
};

interface DemandSiteFormModalProps {
  onClose: () => void;
  programId: number;
  editingDemandSite: DemandSite | null;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 수요처(마스터 정보)를 추가/수정하는 모달입니다.
 * 수요처 단위 기본 관제구역(중심 좌표 + 반경)까지 여기서 정합니다
 * - 기본 관제구역 만으로도 이탈 판정이 되고, 더 세밀한 원/다각형이 필요하면 "거점 관리" 편집기에서 추가합니다.
 */

const DemandSiteFormModal = ({
  onClose,
  programId,
  editingDemandSite,
}: DemandSiteFormModalProps) => {
  const [form, setForm] = useState(
    editingDemandSite
      ? {
          name: editingDemandSite.name,
          address: editingDemandSite.address ?? "",
          contactAdminId:
            editingDemandSite.contactAdminId === null
              ? ""
              : String(editingDemandSite.contactAdminId),
          radius: String(editingDemandSite.radius ?? MIN_RADIUS_METERS),
          baseAreaEnabled: editingDemandSite.baseAreaEnabled,
        }
      : emptyForm,
  );
  const queryClient = useQueryClient();
  const createDemandSiteMutation = useMutation(createDemandSiteMutationOptions(queryClient));
  const updateDemandSiteMutation = useMutation(updateDemandSiteMutationOptions(queryClient));

  // 담당자 지정 UI는 임시로 숨겼지만(아래 주석 처리된 FormField 참고) 조회 로직은 남겨둔다.
  useQuery({
    ...assignableDemandSiteAdminsQueryOptions(programId),
    enabled: !!editingDemandSite,
  });

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
      alert(error instanceof Error ? error.message : "주소 검색을 열 수 없습니다.");
    }
  };

  const handleSaveButtonClick = () => {
    if (!form.name) {
      alert("수요처명을 입력해주세요.");

      return;
    }
    if (!form.address) {
      alert("주소를 입력해주세요.");

      return;
    }
    // 관제 중심 좌표는 서버가 주소로 채운다 — 여기선 반경만 보낸다
    const payload = {
      name: form.name,
      address: form.address || undefined,
      radius: Number(form.radius),
      baseAreaEnabled: form.baseAreaEnabled,
    };
    const onError = (error: unknown) =>
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");

    if (editingDemandSite) {
      updateDemandSiteMutation.mutate(
        {
          id: editingDemandSite.id,
          programId,
          data: {
            ...payload,
            contactAdminId: form.contactAdminId ? Number(form.contactAdminId) : null,
          },
        },
        { onSuccess: () => onClose(), onError },
      );
    } else {
      createDemandSiteMutation.mutate(
        { programId, ...payload },
        { onSuccess: () => onClose(), onError },
      );
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
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
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
          <button type="button" className={btnGhostClass} onClick={handleSearchAddressButtonClick}>
            주소 검색
          </button>
        </div>
      </FormField>

      {/* 담당자 지정 UI는 임시로 숨긴다 — MANAGER가 programIds에 없는 수요처의 담당자로
          지정될 수 있는 권한 불일치가 있어 정리 전까지 노출하지 않는다. 저장 로직
          (form.contactAdminId, handleSaveButtonClick의 contactAdminId 전달)은 그대로 둔다.
      {editingDemandSite && (
        <FormField label="담당자">
          <FilterSelect
            className="w-full"
            value={form.contactAdminId}
            onChange={(value) => setForm((f) => ({ ...f, contactAdminId: value }))}
            options={[
              { value: "", label: "지정 안 함" },
              ...assignableAdmins.map((assignableAdmin) => ({
                value: String(assignableAdmin.id),
                label: assignableAdmin.name ?? `계정 #${assignableAdmin.id}`,
              })),
            ]}
          />
          {editingDemandSite.contactAdminId === null && editingDemandSite.contactPerson && (
            <p className="text-[11.5px] text-[#9aa1ab] mt-1.5">
              예전에 입력된 담당자: {editingDemandSite.contactPerson}
            </p>
          )}
        </FormField>
      )}
      */}

      {/* 수요처 단위 관제구역 — 거점을 따로 안 그려도 이 원으로 이탈 판정이 된다 */}
      <FormField label="기본 관제구역 사용">
        <label className="flex items-center gap-1.5 text-[13px] text-[#374151]">
          <input
            type="checkbox"
            checked={form.baseAreaEnabled}
            onChange={(event) => setForm((f) => ({ ...f, baseAreaEnabled: event.target.checked }))}
          />
          입력한 주소를 중심으로 한 원형 구역을 기본 관제구역으로 설정
        </label>
        <p className="text-[11.5px] text-[#9aa1ab] mt-1.5">
          다각형 관제구역 사용시 체크를 해제하세요
        </p>
      </FormField>

      <FormField label="관제 반경(m)">
        <input
          type="number"
          className={inputClass}
          value={form.radius}
          step={100}
          disabled={!form.baseAreaEnabled}
          onChange={(event) => setForm((f) => ({ ...f, radius: event.target.value }))}
        />
      </FormField>
    </SlideModal>
  );
};

export default DemandSiteFormModal;
