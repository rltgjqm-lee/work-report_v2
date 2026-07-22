import { useState } from "react";

import { createProgram, updateProgram } from "../../api/admin/programs";
import SlideModal from "../../components/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import { ROLES, type Organization, type Program, type Role } from "../../types";

const emptyForm = {
  organizationId: "",
  name: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  programType: "",
  hourlyWage: "10320",
  educationAmount: "0",
  educationType: "add" as "add" | "deduct",
  dementiaAmount: "0",
  dementiaType: "deduct" as "add" | "deduct",
};

interface ProgramFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  editingProgram: Program | null;
  currentRole: Role;
  organizations: Organization[];
}

// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 아래 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const ProgramFormModal = ({
  onClose,
  onSaved,
  editingProgram,
  currentRole,
  organizations,
}: ProgramFormModalProps) => {
  const [form, setForm] = useState(
    editingProgram
      ? {
          organizationId: String(editingProgram.organizationId),
          name: editingProgram.name,
          startDate: editingProgram.startDate,
          endDate: editingProgram.endDate,
          startTime: editingProgram.startTime,
          endTime: editingProgram.endTime,
          programType: editingProgram.programType ?? "",
          hourlyWage: String(editingProgram.hourlyWage),
          educationAmount: String(editingProgram.educationAmount),
          educationType: editingProgram.educationType,
          dementiaAmount: String(editingProgram.dementiaAmount),
          dementiaType: editingProgram.dementiaType,
        }
      : emptyForm,
  );
  const [error, setError] = useState<string | null>(null);

  const handleSaveButtonClick = async () => {
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      setError("종료일은 시작일 이후여야 합니다.");

      return;
    }
    if (form.endTime && form.startTime && form.endTime < form.startTime) {
      setError("종료 시간은 시작 시간 이후여야 합니다.");

      return;
    }

    try {
      const payload = {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        programType: form.programType || undefined,
        hourlyWage: Number(form.hourlyWage),
        educationAmount: Number(form.educationAmount),
        educationType: form.educationType,
        dementiaAmount: Number(form.dementiaAmount),
        dementiaType: form.dementiaType,
        ...(currentRole === ROLES.SUPER_ADMIN && !editingProgram
          ? { organizationId: Number(form.organizationId) }
          : {}),
      };

      if (editingProgram) {
        await updateProgram(editingProgram.id, payload);
      } else {
        await createProgram(payload);
      }
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title={editingProgram ? "사업단 정보 수정" : "사업단 추가"}
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
      {/* 기관 선택 */}
      {currentRole === ROLES.SUPER_ADMIN && !editingProgram && (
        <FormField label="기관 선택">
          <FilterSelect
            className="w-full"
            value={form.organizationId}
            onChange={(value) =>
              setForm((f) => ({ ...f, organizationId: value }))
            }
            options={[
              { value: "", label: "선택하세요" },
              ...organizations
                .filter((organization) => organization.isActive)
                .map((organization) => ({
                  value: String(organization.id),
                  label: organization.name,
                })),
            ]}
          />
        </FormField>
      )}

      {/* 사업단 명 */}
      <FormField label="사업단 명">
        <input
          className={inputClass}
          value={form.name}
          onChange={(event) =>
            setForm((f) => ({ ...f, name: event.target.value }))
          }
        />
      </FormField>

      <div className="flex gap-3">
        {/* 시작일 */}
        <div className="flex-1">
          <FormField label="시작일">
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(event) =>
                setForm((f) => ({ ...f, startDate: event.target.value }))
              }
            />
          </FormField>
        </div>

        {/* 종료일 */}
        <div className="flex-1">
          <FormField label="종료일">
            <input
              type="date"
              className={inputClass}
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(event) =>
                setForm((f) => ({ ...f, endDate: event.target.value }))
              }
            />
          </FormField>
        </div>
      </div>

      <div className="flex gap-3">
        {/* 시작 시간 */}
        <div className="flex-1">
          <FormField label="시작 시간">
            <input
              type="time"
              className={inputClass}
              value={form.startTime}
              onChange={(event) =>
                setForm((f) => ({ ...f, startTime: event.target.value }))
              }
            />
          </FormField>
        </div>

        {/* 종료 시간  */}
        <div className="flex-1">
          <FormField label="종료 시간">
            <input
              type="time"
              className={inputClass}
              value={form.endTime}
              min={form.startTime || undefined}
              onChange={(event) =>
                setForm((f) => ({ ...f, endTime: event.target.value }))
              }
            />
          </FormField>
        </div>
      </div>

      {/* 사업 유형 */}
      <FormField label="사업 유형">
        <FilterSelect
          className="w-full"
          value={form.programType}
          onChange={(value) => setForm((f) => ({ ...f, programType: value }))}
          options={[
            { value: "", label: "선택하세요" },
            { value: "공익 활동", label: "공익 활동" },
            { value: "역량 활동", label: "역량 활동" },
          ]}
        />
      </FormField>

      {/* 시급 */}
      <FormField label="시급(원)">
        <input
          type="number"
          className={inputClass}
          value={form.hourlyWage}
          onChange={(event) =>
            setForm((f) => ({ ...f, hourlyWage: event.target.value }))
          }
        />
      </FormField>

      <div className="flex gap-3">
        {/* 교육비 */}
        <div className="flex-1">
          <FormField label="교육비(원)">
            <input
              type="number"
              className={inputClass}
              value={form.educationAmount}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  educationAmount: event.target.value,
                }))
              }
            />
          </FormField>
        </div>

        {/* 교육비 처리 - 가산/차감 */}
        <div className="flex-1">
          <FormField label="교육비 처리">
            <FilterSelect
              className="w-full"
              value={form.educationType}
              onChange={(value) =>
                setForm((f) => ({
                  ...f,
                  educationType: value as "add" | "deduct",
                }))
              }
              options={[
                { value: "add", label: "가산" },
                { value: "deduct", label: "차감" },
              ]}
            />
          </FormField>
        </div>
      </div>

      <div className="flex gap-3">
        {/* 치매 검진비 */}
        <div className="flex-1">
          <FormField label="치매 검진비(원)">
            <input
              type="number"
              className={inputClass}
              value={form.dementiaAmount}
              onChange={(event) =>
                setForm((f) => ({ ...f, dementiaAmount: event.target.value }))
              }
            />
          </FormField>
        </div>

        {/* 치매 검진비 처리 - 가산/차감 */}
        <div className="flex-1">
          <FormField label="치매검진비 처리">
            <FilterSelect
              className="w-full"
              value={form.dementiaType}
              onChange={(value) =>
                setForm((f) => ({
                  ...f,
                  dementiaType: value as "add" | "deduct",
                }))
              }
              options={[
                { value: "add", label: "가산" },
                { value: "deduct", label: "차감" },
              ]}
            />
          </FormField>
        </div>
      </div>

      {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
    </SlideModal>
  );
};

export default ProgramFormModal;
