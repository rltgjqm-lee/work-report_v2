import { useEffect, useState } from "react";

import {
  createDemandSite,
  listAssignableDemandSiteAdmins,
  updateDemandSite,
} from "../../api/admin/demandSites";
import { loadDaumPostcodeScript } from "../../utils/loadDaumPostcode";
import SlideModal from "../../components/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { DemandSite } from "../../types";

// GPS 오차를 감안한 최소 반경 — 서버(demandSites 라우트)에서도 같은 값으로 올려잡는다
const MIN_RADIUS_METERS = 1500;

const emptyForm = {
  name: "",
  address: "",
  contactAdminId: "",
  radius: String(MIN_RADIUS_METERS),
};

interface DemandSiteFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  programId: number;
  editingDemandSite: DemandSite | null;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 수요처(마스터 정보)를 추가/수정하는 모달입니다.
 * 수요처 단위 기본 관제구역(중심 좌표 + 반경)까지 여기서 정합니다 — 이것만 있어도
 * 이탈 판정이 되고, 더 세밀한 원/다각형이 필요하면 "거점 관리" 편집기에서 추가합니다.
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
          contactAdminId:
            editingDemandSite.contactAdminId === null
              ? ""
              : String(editingDemandSite.contactAdminId),
          radius: String(editingDemandSite.radius ?? MIN_RADIUS_METERS),
        }
      : emptyForm,
  );
  const [assignableAdmins, setAssignableAdmins] = useState<
    { id: number; name: string | null }[]
  >([]);

  // 담당자는 신규 등록 때 서버가 사업단 담당자로 자동 지정하므로, 고를 일은 수정할 때뿐이다
  useEffect(() => {
    if (!editingDemandSite) return;
    listAssignableDemandSiteAdmins(programId).then(setAssignableAdmins);
  }, [editingDemandSite, programId]);

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
      // 관제 중심 좌표는 서버가 주소로 채운다 — 여기선 반경만 보낸다
      const payload = {
        name: form.name,
        address: form.address || undefined,
        radius: Number(form.radius),
      };
      if (editingDemandSite) {
        await updateDemandSite(editingDemandSite.id, {
          ...payload,
          contactAdminId: form.contactAdminId
            ? Number(form.contactAdminId)
            : null,
        });
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
      {/* 담당자는 수정할 때만 고른다 — 새로 만들 땐 사업단 담당자를 그대로 물려받는다 */}
      {editingDemandSite && (
        <FormField label="담당자">
          <FilterSelect
            className="w-full"
            value={form.contactAdminId}
            onChange={(value) =>
              setForm((f) => ({ ...f, contactAdminId: value }))
            }
            options={[
              { value: "", label: "지정 안 함" },
              ...assignableAdmins.map((assignableAdmin) => ({
                value: String(assignableAdmin.id),
                label: assignableAdmin.name ?? `계정 #${assignableAdmin.id}`,
              })),
            ]}
          />
          {editingDemandSite.contactAdminId === null &&
            editingDemandSite.contactPerson && (
              <p className="text-[11.5px] text-[#9aa1ab] mt-1.5">
                예전에 입력된 담당자: {editingDemandSite.contactPerson}
              </p>
            )}
        </FormField>
      )}

      {/* 수요처 단위 관제구역 — 거점을 따로 안 그려도 이 원으로 이탈 판정이 된다 */}
      <FormField label={`관제 반경(m, 최소 ${MIN_RADIUS_METERS})`}>
        <input
          type="number"
          className={inputClass}
          value={form.radius}
          min={MIN_RADIUS_METERS}
          step={100}
          onChange={(event) =>
            setForm((f) => ({ ...f, radius: event.target.value }))
          }
        />
        <p className="text-[11.5px] text-[#9aa1ab] mt-1.5">
          관제 중심은 위 주소 위치로 잡힙니다. 주소가 없으면 이 수요처는
          관제되지 않습니다 — 거점 관리에서 구역을 직접 그려도 됩니다.
        </p>
      </FormField>
    </SlideModal>
  );
};

export default DemandSiteFormModal;
