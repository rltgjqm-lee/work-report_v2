import { useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { organizationOptionsQueryOptions } from "../../api/admin/organizations";
import {
  programEditQueryOptions,
  programsByOrganizationQueryOptions,
  updateProgramMutationOptions,
} from "../../api/admin/programs";
import { PROGRAM_TYPE_FILTER_OPTIONS } from "../../constants/programTypes";
import { useAuth } from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { usePagination } from "../../hooks/usePagination";
import { ROLES } from "../../types/admins";
import type { Program, ProgramListItem } from "../../types/programs";

import Button from "../../components/Button";
import ProgramTypeChip from "../../components/chip/ProgramTypeChip";
import FilterSelect from "../../components/FilterSelect";
import Pagination from "../../components/Pagination";
import SearchInput from "../../components/SearchInput";

import { rowActionBtnClass } from "../../uiClasses";
import ProgramFormModal from "./ProgramFormModal";

/**
 * 관리자 페이지 > 사업단 관리 페이지입니다.
 *
 */
const ProgramsPage = () => {
  const { admin } = useAuth();
  const role = admin?.role;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [instFilter, setInstFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [programTypeFilter, setProgramTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  const { data: organizations = [] } = useQuery(organizationOptionsQueryOptions);

  // 목록 자체는 전체가 보이지만(백엔드 GET /summary), 수정/비활성화는 본인이
  // 담당하는 사업단만 가능하다(canManageProgram과 같은 기준) — 눌러봤자 403 나는
  // 죽은 버튼을 안 보이게 미리 걸러준다.
  const canManageProgramRow = (program: ProgramListItem) =>
    role === ROLES.SUPER_ADMIN ||
    role === ROLES.ORGANIZATION_ADMIN ||
    !!admin?.programIds.includes(program.id);


  const selectedOrganizationId =
    role === ROLES.SUPER_ADMIN
      ? instFilter === "all"
        ? undefined
        : Number(instFilter)
      : undefined;

  const { data: programs = [] } = useQuery(
    programsByOrganizationQueryOptions(selectedOrganizationId),
  );

  // 사업단 셀렉트 후보는 유형 필터로 이미 좁혀둔다 — 안 그러면 유형과 안 맞는
  // 사업단을 골라서 결과가 항상 0건이 되는 조합이 가능해진다.
  const programsForSelect = useMemo(
    () =>
      programTypeFilter === "all"
        ? programs
        : programs.filter((program) => program.programType === programTypeFilter),
    [programs, programTypeFilter],
  );

  const filtered = useMemo(() => {
    let list = programs;

    if (programTypeFilter !== "all") {
      list = list.filter((program) => program.programType === programTypeFilter);
    }
    if (programFilter !== "all") {
      list = list.filter((program) => program.id === Number(programFilter));
    }
    if (search) {
      list = list.filter((program) => program.name.includes(search));
    }

    return list;
  }, [programs, programTypeFilter, programFilter, search]);

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, 6);

  const handleAddButtonClick = () => {
    setEditingProgram(null);
    setModalOpen(true);
  };

  const handleEditButtonClick =
    (program: ProgramListItem) => async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      try {
        const fullProgram = await queryClient.fetchQuery(programEditQueryOptions(program.id));
        setEditingProgram(fullProgram);
        setModalOpen(true);
      } catch (error) {
        alert(error instanceof Error ? error.message : "사업단 정보를 불러오지 못했습니다.");
      }
    };

  const updateProgramMutation = useMutation(updateProgramMutationOptions(queryClient));

  const handleToggleActiveButtonClick =
    (program: ProgramListItem) => (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const actionLabel = program.isActive ? "비활성화" : "활성화";
      if (
        !confirm(
          `'${program.name}' 사업단을 ${actionLabel}하시겠습니까?${
            program.isActive ? " 소속된 활성 참여자는 모두 참여종료 처리됩니다." : ""
          }`,
        )
      )
        return;

      updateProgramMutation.mutate(
        { id: program.id, data: { isActive: !program.isActive } },
        {
          onSuccess: () => showToast(`'${program.name}' 사업단을 ${actionLabel}했습니다.`),
          onError: (error) =>
            alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
        },
      );
    };

  const handleInstitutionFilterChange = (value: string) => {
    setInstFilter(value);
    setProgramFilter("all");
  };

  const handleProgramTypeFilterChange = (value: string) => {
    setProgramTypeFilter(value);
    setProgramFilter("all");
  };

  const institutionOptions = [
    { value: "all", label: "전체 기관" },
    ...organizations.map((organization) => ({
      value: String(organization.id),
      label: organization.name,
    })),
  ];

  const programOptions = [
    { value: "all", label: "전체 사업단" },
    ...programsForSelect.map((program) => ({
      value: String(program.id),
      label: program.name,
    })),
  ];

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold m-0">사업단 관리</h1>
          <p className="text-[13px] text-text-subtle mt-1.5">
            기관별 사업단 목록을 조회하고 등록합니다.
          </p>
        </div>
        <Button onClick={handleAddButtonClick}>+ 사업단 추가</Button>
      </div>

      <div className="bg-white border border-admin-border-subtle rounded-[2px]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-faint flex-wrap">
          <div className="flex items-center gap-2.5">
            {role === ROLES.SUPER_ADMIN && (
              <FilterSelect
                value={instFilter}
                onChange={handleInstitutionFilterChange}
                options={institutionOptions}
              />
            )}

            <FilterSelect
              value={programTypeFilter}
              onChange={handleProgramTypeFilterChange}
              options={PROGRAM_TYPE_FILTER_OPTIONS}
            />

            <FilterSelect
              value={programFilter}
              onChange={setProgramFilter}
              options={programOptions}
            />

            <SearchInput value={search} onChange={setSearch} placeholder="사업단명 검색" />
          </div>
          <span className="text-xs text-text-subtle font-medium whitespace-nowrap">
            총 {filtered.length}개 사업단
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse min-w-[1350px]">
            <thead>
              <tr>
                <th className="w-[210px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  사업단명
                </th>
                <th className="w-[150px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  소속기관
                </th>
                <th className="w-[190px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  기간
                </th>
                <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  운영시간
                </th>
                <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  참여자수
                </th>
                <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  상태
                </th>
                <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  담당자
                </th>
                <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  보조 담당자
                </th>
                <th className="w-[160px] bg-admin-surface-header border-b border-admin-border-subtle" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((program) => (
                <tr
                  key={program.id}
                  className="hover:bg-admin-row-hover"
                  onClick={() => navigate(`/admin/program?id=${program.id}`)}
                >
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    <span className="inline-flex items-center gap-2">
                      <ProgramTypeChip programType={program.programType} />
                      {program.name}
                    </span>
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    {program.organizationName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                    {program.startDate} ~ {program.endDate}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                    {program.startTime} ~ {program.endTime}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                    {program.participantCount}명
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    {program.isActive ? "활성" : "비활성"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    {program.managerName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    {program.secondaryContactAdminName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                    {canManageProgramRow(program) && (
                      <>
                        <button
                          className={rowActionBtnClass}
                          onClick={handleEditButtonClick(program)}
                        >
                          수정
                        </button>
                        <button
                          className={rowActionBtnClass}
                          onClick={handleToggleActiveButtonClick(program)}
                        >
                          {program.isActive ? "비활성화" : "활성화"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {modalOpen && (
        <ProgramFormModal
          onClose={() => setModalOpen(false)}
          editingProgram={editingProgram}
          currentRole={role ?? ROLES.MANAGER}
          organizations={organizations}
        />
      )}
    </div>
  );
};

export default ProgramsPage;
