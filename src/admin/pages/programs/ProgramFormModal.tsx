import { useState } from "react";

import {
  createProgram,
  setProgramManager,
  updateProgram,
} from "../../api/admin/programs";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import {
  ROLES,
  type Admin,
  type Organization,
  type Program,
  type Role,
} from "../../types";

const emptyForm = {
  organizationId: "",
  name: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  programType: "",
  hourlyWage: "10320",
};

interface ProgramFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  editingProgram: Program | null;
  currentRole: Role;
  organizations: Organization[];
  managerAdmins: Admin[];
}

/**
 * 관리자 페이지 > 사업단 관리 페이지에서 사업단을 추가/수정하는 모달입니다.
 *
 */
// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 아래 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const ProgramFormModal = ({
  onClose,
  onSaved,
  editingProgram,
  currentRole,
  organizations,
  managerAdmins,
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
        }
      : emptyForm,
  );
  // 담당자는 사업단이 아니라 관리자 계정 쪽에 붙어있다 — MANAGER 계정의 programIds가
  // "이 사람이 담당하는 사업단" 목록이고, 서버 권한 판정(canAccessProgram)도 이 값을 본다.
  // 그래서 지금 담당자가 누구인지도 그 목록에서 거꾸로 찾아낸다.
  const [managerAdminId, setManagerAdminId] = useState(() => {
    if (!editingProgram) return "";

    const assignedManagerAdmin = managerAdmins.find((managerAdmin) =>
      managerAdmin.programIds.includes(editingProgram.id),
    );

    return assignedManagerAdmin ? String(assignedManagerAdmin.id) : "";
  });
  // 처음 담긴 값을 붙잡아 두고 바뀐 경우에만 서버에 보낸다 — 계정 목록이 아직 안 실려서
  // 선택이 비어있는 상태로 저장해도 멀쩡한 담당자가 해제되지 않게 한다.
  const [initialManagerAdminId] = useState(managerAdminId);
  const [error, setError] = useState<string | null>(null);

  // 슈퍼 관리자는 전 기관 계정을 다 받아오므로 선택한 기관으로 좁힌다.
  // 기관 관리자는 서버가 이미 자기 기관 계정만 내려준다.
  const assignableManagerAdmins = managerAdmins.filter(
    (managerAdmin) =>
      currentRole !== ROLES.SUPER_ADMIN ||
      String(managerAdmin.organizationId) === form.organizationId,
  );

  // 담당자 지정은 서버에 맡긴다 — 이전/새 담당자 계정 정리와 소속 수요처 담당자 전파를
  // 한 곳에서 처리해야 화면마다 제각각으로 어긋나지 않는다.
  // 목록이 아직 안 실려서 아무것도 못 골랐다면 건드리지 않는다(멀쩡한 담당자 해제 방지).
  const saveManagerAdmin = async (programId: number) => {
    if (managerAdminId === initialManagerAdminId) return;

    await setProgramManager(
      programId,
      managerAdminId ? Number(managerAdminId) : null,
    );
  };

  const handleSaveButtonClick = async () => {
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      setError("종료일은 시작일 이후여야 합니다.");

      return;
    }
    if (form.endTime && form.startTime && form.endTime < form.startTime) {
      setError("종료 시간은 시작 시간 이후여야 합니다.");

      return;
    }
    // 담당자는 신규 등록에서만 필수 — 담당자 없이 이미 만들어진 사업단의
    // 다른 항목을 고치는 것까지 막을 이유는 없다.
    if (!editingProgram && !managerAdminId) {
      setError("담당자를 선택해주세요.");

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
        ...(currentRole === ROLES.SUPER_ADMIN && !editingProgram
          ? { organizationId: Number(form.organizationId) }
          : {}),
      };

      if (editingProgram) {
        await updateProgram(editingProgram.id, payload);
        await saveManagerAdmin(editingProgram.id);
      } else {
        const createdProgram = await createProgram(payload);
        await saveManagerAdmin(createdProgram.id);
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
            onChange={(value) => {
              setForm((f) => ({ ...f, organizationId: value }));
              // 기관이 바뀌면 이전 기관 담당자 선택은 더 이상 유효하지 않다
              setManagerAdminId("");
            }}
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

      {/* 담당자 (담당자 역할 관리자 계정) */}
      <FormField label={editingProgram ? "담당자" : "담당자 (필수)"}>
        {assignableManagerAdmins.length === 0 ? (
          <p className="text-[12.5px] text-[#9aa1ab]">
            {currentRole === ROLES.SUPER_ADMIN && !form.organizationId
              ? "기관을 먼저 선택하세요."
              : "지정할 수 있는 담당자 계정이 없습니다."}
          </p>
        ) : (
          <FilterSelect
            className="w-full"
            value={managerAdminId}
            onChange={setManagerAdminId}
            options={[
              { value: "", label: "선택하세요" },
              ...assignableManagerAdmins.map((managerAdmin) => ({
                value: String(managerAdmin.id),
                label: managerAdmin.name ?? managerAdmin.email,
              })),
            ]}
          />
        )}
      </FormField>

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
              step={600}
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
              step={600}
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

      {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
    </SlideModal>
  );
};

export default ProgramFormModal;
