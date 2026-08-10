import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { transferAdminProgramsMutationOptions } from "../../api/admin/admins";
import { programsByOrganizationQueryOptions } from "../../api/admin/programs";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { useToast } from "../../context/useToast";
import Button from "../../components/Button";
import { ROLES, type Admin, type Role } from "../../types";

// 이관 후보로 담당자(MANAGER)와 부관리자(SUB_ADMIN)가 섞여 나오므로
// 이름만으로는 구분이 안 돼 역할을 같이 표시한다.
const ROLE_LABEL: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "서비스 총괄 관리자",
  [ROLES.ORGANIZATION_ADMIN]: "기관 관리자",
  [ROLES.SUB_ADMIN]: "부관리자",
  [ROLES.MANAGER]: "담당자",
};

interface TransferProgramsModalProps {
  onClose: () => void;
  target: Admin;
  candidates: Admin[];
}

/**
 * 관리자 페이지 > 관리자 계정 페이지에서 담당자의 담당 사업단을 다른 담당자에게
 * 이관하는 모달입니다. 퇴사 등으로 계정을 비활성화하기 전에 먼저 거치는 단계입니다.
 * 사업단마다 다른 담당자에게 나눠서 이관할 수 있습니다.
 */
// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const TransferProgramsModal = ({ onClose, target, candidates }: TransferProgramsModalProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const transferAdminProgramsMutation = useMutation(
    transferAdminProgramsMutationOptions(queryClient),
  );

  const { data: organizationPrograms = [] } = useQuery(
    programsByOrganizationQueryOptions(target.organizationId ?? undefined),
  );
  const targetPrograms = useMemo(
    () => organizationPrograms.filter((program) => target.programIds.includes(program.id)),
    [organizationPrograms, target.programIds],
  );

  // programId -> 이관받을 담당자 id(문자열, FilterSelect 값 형식)
  const [assignmentByProgramId, setAssignmentByProgramId] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const targetName = target.name ?? target.email;

  const handleApplyToAllButtonClick = (toAdminId: string) => {
    setAssignmentByProgramId(
      Object.fromEntries(targetPrograms.map((program) => [program.id, toAdminId])),
    );
  };

  const handleTransferButtonClick = () => {
    const assignments = targetPrograms.map((program) => ({
      programId: program.id,
      toAdminId: Number(assignmentByProgramId[program.id]),
    }));

    if (assignments.some((assignment) => !assignment.toAdminId)) {
      setError("모든 사업단에 이관받을 담당자를 선택해주세요.");

      return;
    }

    setError(null);
    transferAdminProgramsMutation.mutate(
      { id: target.id, assignments },
      {
        // UI 한정: 이관 결과 안내와 모달 닫기는 이 화면에서만 의미 있다.
        onSuccess: (result) => {
          showToast(
            `사업단 ${result.programCount}개, 수요처 ${result.demandSiteCount}곳의 담당자를 변경했습니다.`,
          );
          onClose();
        },
        onError: (error) =>
          setError(error instanceof Error ? error.message : "이관에 실패했습니다."),
      },
    );
  };

  const candidateOptions = [
    { value: "", label: "선택하세요" },
    ...candidates.map((candidate) => ({
      value: String(candidate.id),
      label: `${candidate.name ?? candidate.email} (${ROLE_LABEL[candidate.role]})`,
    })),
  ];

  return (
    <SlideModal
      isOpen
      title={`'${targetName}' 님 담당 이관`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleTransferButtonClick}>
            이관
          </Button>
        </>
      }
    >
      <p className="text-xs text-text-subtle">
        담당 사업단 {targetPrograms.length}개를 사업단별로 다른 담당자에게 나눠서 넘길 수 있습니다.
        해당 사업단의 수요처 담당자도 함께 변경됩니다.
      </p>

      {candidates.length === 0 ? (
        <p className="text-[12.5px] text-admin-text-placeholder">
          이관받을 수 있는 다른 담당자/부관리자 계정이 없습니다. 계정을 먼저 발급해주세요.
        </p>
      ) : (
        <>
          <FormField label="전체 일괄 적용">
            <FilterSelect
              className="w-full"
              value=""
              onChange={handleApplyToAllButtonClick}
              options={candidateOptions}
            />
          </FormField>

          {targetPrograms.map((program) => (
            <FormField key={program.id} label={program.name}>
              <FilterSelect
                className="w-full"
                value={assignmentByProgramId[program.id] ?? ""}
                onChange={(value) =>
                  setAssignmentByProgramId((prev) => ({ ...prev, [program.id]: value }))
                }
                options={candidateOptions}
              />
            </FormField>
          ))}
        </>
      )}
      {error && <p className="text-[12.5px] text-admin-error-text">{error}</p>}
    </SlideModal>
  );
};

export default TransferProgramsModal;
