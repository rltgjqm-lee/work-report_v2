import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  programQueryOptions,
  programsByOrganizationQueryOptions,
  updateProgramMutationOptions,
} from "../../api/admin/programs";
import { adminsQueryOptions } from "../../api/admin/admins";
import { organizationsQueryOptions } from "../../api/admin/organizations";
import Pagination from "../../components/Pagination";
import ProgramTypeChip from "../../components/chip/ProgramTypeChip";
import ProgramFormModal from "./ProgramFormModal";
import SearchInput from "../../components/SearchInput";
import FilterSelect from "../../components/FilterSelect";
import { usePagination } from "../../hooks/usePagination";
import { useAuth } from "../../context/useAuth";
import { btnPrimaryClass, rowActionBtnClass } from "../../uiClasses";
import { ROLES, type Program } from "../../types";

/**
 * 관리자 페이지 > 사업단 관리 페이지입니다.
 *
 */
const ProgramsPage = () => {
  const { admin } = useAuth();
  const role = admin?.role;

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [instFilter, setInstFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  const { data: organizations = [] } = useQuery(organizationsQueryOptions);

  // 담당자 목록을 못 받아오는 역할(부관리자/담당자)에겐 "-"만 늘어놓는 대신 열 자체를 숨긴다.
  const canViewManagerColumn = role === ROLES.SUPER_ADMIN || role === ROLES.ORGANIZATION_ADMIN;

  // 계정 목록 조회 권한이 없는 역할(부관리자/담당자)은 아예 호출하지 않는다 — 403이 난다.
  const { data: admins = [] } = useQuery({
    ...adminsQueryOptions,
    enabled: canViewManagerColumn,
  });
  // 사업단 담당자로 지정할 수 있는 계정 — 서버가 권한에 맞는 범위(슈퍼 관리자는 전체,
  // 기관 관리자는 자기 기관)만 내려주므로 여기선 역할/활성 여부만 걸러낸다.
  const managerAdmins = useMemo(
    () => admins.filter((adminRow) => adminRow.role === ROLES.MANAGER && adminRow.isActive),
    [admins],
  );

  const selectedOrganizationId =
    role === ROLES.SUPER_ADMIN
      ? instFilter === "all"
        ? undefined
        : Number(instFilter)
      : undefined;

  const { data: programs = [] } = useQuery(
    programsByOrganizationQueryOptions(selectedOrganizationId),
  );
  const programQueries = useQueries({
    queries: programs.map((program) => programQueryOptions(program.id)),
  });
  const participantCounts = useMemo(
    () =>
      Object.fromEntries(
        programQueries
          .map((programQuery) => programQuery.data)
          .filter((fullProgram): fullProgram is NonNullable<typeof fullProgram> => !!fullProgram)
          .map((fullProgram) => [fullProgram.id, fullProgram.participants.length] as const),
      ),
    [programQueries],
  );

  const managerAdminName = (programId: number) => {
    const managerAdmin = managerAdmins.find((candidate) =>
      candidate.programIds.includes(programId),
    );

    return managerAdmin?.name ?? managerAdmin?.email ?? "-";
  };

  const orgName = (organizationId: number) =>
    organizations.find((organization) => organization.id === organizationId)?.name ?? "-";

  const filtered = useMemo(
    () => programs.filter((program) => program.name.includes(search)),
    [programs, search],
  );

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, 6);

  const handleAddButtonClick = () => {
    setEditingProgram(null);
    setModalOpen(true);
  };

  const handleEditButtonClick = (program: Program) => {
    setEditingProgram(program);
    setModalOpen(true);
  };

  const updateProgramMutation = useMutation(updateProgramMutationOptions(queryClient));

  const handleToggleActiveButtonClick = (program: Program) => {
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
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold m-0">사업단 관리</h1>
          <p className="text-[13px] text-[#6b7280] mt-1.5">
            기관별 사업단 목록을 조회하고 등록합니다.
          </p>
        </div>
        <button className={btnPrimaryClass} onClick={handleAddButtonClick}>
          + 사업단 추가
        </button>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
          <div className="flex items-center gap-2.5">
            {role === ROLES.SUPER_ADMIN && (
              <FilterSelect
                value={instFilter}
                onChange={setInstFilter}
                options={[
                  { value: "all", label: "전체 기관" },
                  ...organizations.map((organization) => ({
                    value: String(organization.id),
                    label: organization.name,
                  })),
                ]}
              />
            )}

            <SearchInput value={search} onChange={setSearch} placeholder="사업단명 검색" />
          </div>
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}개 사업단
          </span>
        </div>

        <div className="overflow-x-auto">
          <table
            className={`w-full table-fixed border-collapse ${
              canViewManagerColumn ? "min-w-[1220px]" : "min-w-[1100px]"
            }`}
          >
            <thead>
              <tr>
                <th className="w-[230px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  사업단명
                </th>
                <th className="w-[170px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  소속기관
                </th>
                <th className="w-[210px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  기간
                </th>
                <th className="w-[140px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  운영시간
                </th>
                <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  참여자수
                </th>
                <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  상태
                </th>
                {canViewManagerColumn && (
                  <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                    담당자
                  </th>
                )}
                <th className="w-[160px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((program) => (
                <tr
                  key={program.id}
                  className="hover:bg-[#f8fafc]"
                  onClick={() => navigate(`/admin/programs/${program.id}`)}
                >
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    <span className="inline-flex items-center gap-2">
                      <ProgramTypeChip programType={program.programType} />
                      {program.name}
                    </span>
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {orgName(program.organizationId)}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {program.startDate} ~ {program.endDate}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {program.startTime} ~ {program.endTime}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {participantCounts[program.id] ?? "-"}명
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {program.isActive ? "활성" : "비활성"}
                  </td>
                  {canViewManagerColumn && (
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                      {managerAdminName(program.id)}
                    </td>
                  )}
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    <button
                      className={rowActionBtnClass}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEditButtonClick(program);
                      }}
                    >
                      수정
                    </button>
                    <button
                      className={rowActionBtnClass}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleActiveButtonClick(program);
                      }}
                    >
                      {program.isActive ? "비활성화" : "활성화"}
                    </button>
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
          managerAdmins={managerAdmins}
        />
      )}
    </div>
  );
};

export default ProgramsPage;
