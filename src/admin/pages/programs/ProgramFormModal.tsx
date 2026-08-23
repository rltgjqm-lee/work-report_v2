import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProgramMutationOptions,
  managerCandidatesQueryOptions,
  secondaryContactCandidatesQueryOptions,
  setProgramManagerMutationOptions,
  updateProgramMutationOptions,
} from "../../api/admin/programs";
import { PROGRAM_TYPE_SELECT_OPTIONS } from "../../constants/programTypes";
import { useAuth } from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { ROLES, type Role } from "../../types/admins";
import type { OrganizationOption } from "../../types/organizations";
import type { Program } from "../../types/programs";

import Button from "../../components/Button";
import FilterSelect from "../../components/FilterSelect";
import FormField from "../../components/FormField";
import Input from "../../components/Input";
import SlideModal from "../../components/modal/SlideModal";

// 담당자 선택 목록에 담당자(MANAGER)와 부관리자(SUB_ADMIN)가 섞여 나오므로
// 이름만으로는 구분이 안 돼 역할을 같이 표시한다.
const ROLE_LABEL: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "서비스 총괄 관리자",
  [ROLES.ORGANIZATION_ADMIN]: "기관 관리자",
  [ROLES.SUB_ADMIN]: "부관리자",
  [ROLES.MANAGER]: "담당자",
};

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
  editingProgram: Program | null;
  currentRole: Role;
  organizations: OrganizationOption[];
}

/**
 * 관리자 페이지 > 사업단 관리 페이지에서 사업단을 추가/수정하는 모달입니다.
 *
 */
const ProgramFormModal = ({
  onClose,
  editingProgram,
  currentRole,
  organizations,
}: ProgramFormModalProps) => {
  const { admin } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const createProgramMutation = useMutation(createProgramMutationOptions(queryClient));
  const updateProgramMutation = useMutation(updateProgramMutationOptions(queryClient));
  const setProgramManagerMutation = useMutation(setProgramManagerMutationOptions(queryClient));
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
  // 담당자 후보 조회 대상 기관 — SUPER_ADMIN은 폼에서 고른 기관, 그 외 역할은 본인
  // 소속 기관으로 고정한다. 계정 관리 화면(GET /api/admins)과 달리 부관리자/담당자
  // 본인도 이 목록(GET /programs/manager-candidates)을 조회할 수 있어서, 본인이나
  // 동료를 담당자로 고를 수 있다.
  const organizationIdForManagerCandidates =
    currentRole === ROLES.SUPER_ADMIN
      ? form.organizationId
        ? Number(form.organizationId)
        : undefined
      : (admin?.organizationId ?? undefined);
  const { data: managerCandidateAdmins = [] } = useQuery(
    managerCandidatesQueryOptions(organizationIdForManagerCandidates),
  );

  // 담당자는 사업단이 아니라 관리자 계정 쪽에 붙어있다
  const [managerAdminId, setManagerAdminId] = useState(() => {
    if (!editingProgram) return "";

    const assignedManagerAdmin = managerCandidateAdmins.find((managerAdmin) =>
      managerAdmin.programIds.includes(editingProgram.id),
    );

    return assignedManagerAdmin ? String(assignedManagerAdmin.id) : "";
  });
  // 처음 담긴 값을 붙잡아 두고 바뀐 경우에만 서버에 보낸다 — 계정 목록이 아직 안 실려서
  // 선택이 비어있는 상태로 저장해도 멀쩡한 담당자가 해제되지 않게 한다.
  const [initialManagerAdminId] = useState(managerAdminId);
  // 담당자를 바꿀 때 그 사업단 수요처 담당자도 같이 바꿀지 — 기본은 같이 바꾸는 쪽(기존 동작).
  const [updateDemandSiteContacts, setUpdateDemandSiteContacts] = useState(true);
  // 보조 담당자("+1") — programs 테이블의 평범한 컬럼이라 담당자와 달리 별도 API 없이
  // updateProgramMutation/createProgramMutation 페이로드에 그대로 실어 보낸다.
  // 후보 조회도 organizationId 기준이라(담당자 후보와 동일) 생성 시점에도 쓸 수 있다.
  const [secondaryContactAdminId, setSecondaryContactAdminId] = useState(() =>
    editingProgram?.secondaryContactAdminId ? String(editingProgram.secondaryContactAdminId) : "",
  );
  const { data: secondaryContactCandidates = [] } = useQuery(
    secondaryContactCandidatesQueryOptions(organizationIdForManagerCandidates),
  );
  // 역량 활동 사업단 생성 시에만 쓰는 4대보험 적용 여부 — 급여대장/명세서(역량 활동
  // 전용 서식)에서만 이 요율들을 쓰므로 공익 활동은 노출하지 않는다. 기본은 전부 적용
  // (기존 동작과 동일한 기본 요율), 체크 해제한 항목만 0%로 보내 공제를 뺀다.
  const [insuranceEnabled, setInsuranceEnabled] = useState({
    health: true,
    longtermCare: true,
    employment: true,
    industrialAccident: true,
  });
  const [error, setError] = useState<string | null>(null);

  // 담당자 지정은 서버에 맡긴다 — 이전/새 담당자 계정 정리와 소속 수요처 담당자 전파를
  // 한 곳에서 처리해야 화면마다 제각각으로 어긋나지 않는다.
  // 목록이 아직 안 실려서 아무것도 못 골랐다면 건드리지 않는다(멀쩡한 담당자 해제 방지).
  const saveManagerAdmin = async (programId: number) => {
    if (managerAdminId === initialManagerAdminId) return;

    await setProgramManagerMutation.mutateAsync({
      programId,
      adminId: managerAdminId ? Number(managerAdminId) : null,
      updateDemandSiteContacts,
    });
  };

  const handleOrganizationFilterChange = (value: string) => {
    setForm((form) => ({ ...form, organizationId: value }));
    setManagerAdminId("");
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
        ...(!editingProgram && form.programType === "역량 활동"
          ? {
              healthInsuranceRate: insuranceEnabled.health ? undefined : 0,
              longtermCareRate: insuranceEnabled.longtermCare ? undefined : 0,
              employmentInsuranceRate: insuranceEnabled.employment ? undefined : 0,
              employmentInsuranceEmployerRate: insuranceEnabled.employment ? undefined : 0,
              industrialAccidentRate: insuranceEnabled.industrialAccident ? undefined : 0,
            }
          : {}),
        secondaryContactAdminId: secondaryContactAdminId ? Number(secondaryContactAdminId) : null,
      };

      if (editingProgram) {
        await updateProgramMutation.mutateAsync({
          id: editingProgram.id,
          data: payload,
        });
        await saveManagerAdmin(editingProgram.id);
      } else {
        const createdProgram = await createProgramMutation.mutateAsync(payload);
        // SUB_ADMIN/MANAGER가 만들면 서버가 본인을 우선 담당자로 자동 등록해두므로
        // (worker/routes/admin/programs.ts POST /) 아래 PUT /:id/manager 호출이
        // canManageProgram 기준으로 통과한다 — 위에서 고른 담당자로 갈아끼운다.
        await saveManagerAdmin(createdProgram.id);
      }
      showToast(editingProgram ? "사업단 정보를 수정했습니다." : "사업단을 추가했습니다.");
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const organizationOptions = [
    { value: "", label: "선택하세요" },
    ...organizations
      .filter((organization) => organization.isActive)
      .map((organization) => ({
        value: String(organization.id),
        label: organization.name,
      })),
  ];

  const managerAdminOptions = [
    { value: "", label: "선택하세요" },
    ...managerCandidateAdmins.map((managerAdmin) => ({
      value: String(managerAdmin.id),
      label: `${managerAdmin.name ?? managerAdmin.email} (${ROLE_LABEL[managerAdmin.role]})`,
    })),
  ];

  const secondaryContactAdminOptions = [
    { value: "", label: "지정 안 함" },
    ...secondaryContactCandidates.map((candidate) => ({
      value: String(candidate.id),
      label: candidate.name ?? `계정 #${candidate.id}`,
    })),
  ];

  return (
    <SlideModal
      isOpen
      title={editingProgram ? "사업단 정보 수정" : "사업단 추가"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSaveButtonClick}>저장</Button>
        </>
      }
    >
      {/* 기관 선택 */}
      {currentRole === ROLES.SUPER_ADMIN && !editingProgram && (
        <FormField label="기관 선택">
          <FilterSelect
            className="w-full"
            value={form.organizationId}
            onChange={handleOrganizationFilterChange}
            options={organizationOptions}
          />
        </FormField>
      )}

      {/* 담당자 (담당자 또는 부관리자 역할 관리자 계정) — SUB_ADMIN/MANAGER 본인도
          이 목록을 조회할 수 있어서 자기 자신이나 동료를 고를 수 있다. */}
      <FormField label={editingProgram ? "담당자" : "담당자 (필수)"}>
        {managerCandidateAdmins.length === 0 ? (
          <p className="text-[12.5px] text-admin-text-placeholder">
            {currentRole === ROLES.SUPER_ADMIN && !form.organizationId
              ? "기관을 먼저 선택하세요."
              : "지정할 수 있는 담당자 계정이 없습니다."}
          </p>
        ) : (
          <FilterSelect
            className="w-full"
            value={managerAdminId}
            onChange={setManagerAdminId}
            options={managerAdminOptions}
          />
        )}
      </FormField>

      {editingProgram && (
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={updateDemandSiteContacts}
            onChange={(event) => setUpdateDemandSiteContacts(event.target.checked)}
          />
          이 사업단 수요처 담당자도 함께 변경
        </label>
      )}

      {/* 보조 담당자 — 수요처 담당자로 지정 가능한 "+1". 같은 기관 소속이면 역할
          무관하게(총괄관리자 제외) 자유롭게 고른다. */}
      <FormField label="보조 담당자">
        <FilterSelect
          className="w-full"
          value={secondaryContactAdminId}
          onChange={setSecondaryContactAdminId}
          options={secondaryContactAdminOptions}
        />
        <p className="text-[11.5px] text-admin-text-placeholder mt-1.5">
          수요처 담당자로 지정할 수 있는 사람은 이 사업단 담당자와 보조 담당자
          둘뿐입니다.
        </p>
      </FormField>

      {/* 사업 유형 */}
      <FormField label="사업 유형">
        <FilterSelect
          className="w-full"
          value={form.programType}
          onChange={(value) => setForm((form) => ({ ...form, programType: value }))}
          options={PROGRAM_TYPE_SELECT_OPTIONS}
        />
      </FormField>

      {/* 4대보험 적용 — 역량 활동 신규 생성 시에만, 급여대장/명세서에서 이 요율을 쓴다 */}
      {!editingProgram && form.programType === "역량 활동" && (
        <FormField label="4대보험 적용">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={insuranceEnabled.health}
                onChange={(event) =>
                  setInsuranceEnabled((insuranceEnabled) => ({
                    ...insuranceEnabled,
                    health: event.target.checked,
                  }))
                }
              />
              건강보험
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={insuranceEnabled.longtermCare}
                onChange={(event) =>
                  setInsuranceEnabled((insuranceEnabled) => ({
                    ...insuranceEnabled,
                    longtermCare: event.target.checked,
                  }))
                }
              />
              장기요양보험
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={insuranceEnabled.employment}
                onChange={(event) =>
                  setInsuranceEnabled((insuranceEnabled) => ({
                    ...insuranceEnabled,
                    employment: event.target.checked,
                  }))
                }
              />
              고용보험
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={insuranceEnabled.industrialAccident}
                onChange={(event) =>
                  setInsuranceEnabled((insuranceEnabled) => ({
                    ...insuranceEnabled,
                    industrialAccident: event.target.checked,
                  }))
                }
              />
              산재보험
            </label>
          </div>
        </FormField>
      )}

      {/* 사업단 명 */}
      <FormField label="사업단 명">
        <Input
          value={form.name}
          onChange={(event) => setForm((form) => ({ ...form, name: event.target.value }))}
        />
      </FormField>

      <div className="flex gap-3">
        {/* 시작일 */}
        <div className="flex-1">
          <FormField label="시작일">
            <Input
              type="date"
              value={form.startDate}
              onChange={(event) => setForm((form) => ({ ...form, startDate: event.target.value }))}
            />
          </FormField>
        </div>

        {/* 종료일 */}
        <div className="flex-1">
          <FormField label="종료일">
            <Input
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(event) => setForm((form) => ({ ...form, endDate: event.target.value }))}
            />
          </FormField>
        </div>
      </div>

      <div className="flex gap-3">
        {/* 시작 시간 */}
        <div className="flex-1">
          <FormField label="시작 시간">
            <Input
              type="time"
              step={600}
              value={form.startTime}
              onChange={(event) => setForm((form) => ({ ...form, startTime: event.target.value }))}
            />
          </FormField>
        </div>

        {/* 종료 시간  */}
        <div className="flex-1">
          <FormField label="종료 시간">
            <Input
              type="time"
              step={600}
              value={form.endTime}
              min={form.startTime || undefined}
              onChange={(event) => setForm((form) => ({ ...form, endTime: event.target.value }))}
            />
          </FormField>
        </div>
      </div>

      {/* 시급 */}
      <FormField label="시급(원)">
        <Input
          type="number"
          value={form.hourlyWage}
          onChange={(event) => setForm((form) => ({ ...form, hourlyWage: event.target.value }))}
        />
      </FormField>

      {error && <p className="text-[12.5px] text-admin-error-text">{error}</p>}
    </SlideModal>
  );
};

export default ProgramFormModal;
