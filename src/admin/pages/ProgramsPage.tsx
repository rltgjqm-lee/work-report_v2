import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getProgram, listPrograms, updateProgram } from "../api/admin/programs";
import { listOrganizations } from "../api/admin/organizations";
import Pagination from "../components/Pagination";
import ProgramFormModal from "../components/modals/ProgramFormModal";
import SearchInput from "../components/SearchInput";
import FilterSelect from "../components/FilterSelect";
import { usePagination } from "../hooks/usePagination";
import { useAuth } from "../context/useAuth";
import { btnPrimaryClass, rowActionBtnClass } from "../uiClasses";
import { ROLES, type Organization, type Program } from "../types";

/**
 * 관리자 페이지 > 사업단 관리 페이지입니다.
 *
 */
const ProgramsPage = () => {
  const { admin } = useAuth();
  const role = admin?.role;

  const navigate = useNavigate();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [participantCounts, setParticipantCounts] = useState<
    Record<number, number>
  >({});
  const [instFilter, setInstFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  useEffect(() => {
    listOrganizations().then(setOrganizations);
  }, []);

  const refreshPrograms = () => {
    const organizationId =
      role === ROLES.SUPER_ADMIN
        ? instFilter === "all"
          ? undefined
          : Number(instFilter)
        : undefined;

    listPrograms(organizationId).then((list) => {
      setPrograms(list);
      Promise.all(
        list.map((program) =>
          getProgram(program.id).then(
            (full) => [program.id, full.participants.length] as const,
          ),
        ),
      ).then((pairs) => setParticipantCounts(Object.fromEntries(pairs)));
    });
  };

  useEffect(refreshPrograms, [instFilter, role]);

  const orgName = (organizationId: number) =>
    organizations.find((organization) => organization.id === organizationId)
      ?.name ?? "-";

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

  const handleProgramSaved = () => {
    setModalOpen(false);
    refreshPrograms();
  };

  const handleToggleActiveButtonClick = async (program: Program) => {
    const actionLabel = program.isActive ? "비활성화" : "활성화";
    if (
      !confirm(
        `'${program.name}' 사업단을 ${actionLabel}하시겠습니까?${
          program.isActive
            ? " 소속된 활성 참여자는 모두 참여종료 처리됩니다."
            : ""
        }`,
      )
    )
      return;

    try {
      await updateProgram(program.id, { isActive: !program.isActive });
      refreshPrograms();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
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

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="사업단명 검색"
            />
          </div>
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}개 사업단
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse">
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
                    {program.name}
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
          onSaved={handleProgramSaved}
          editingProgram={editingProgram}
          currentRole={role ?? ROLES.MANAGER}
          organizations={organizations}
        />
      )}
    </div>
  );
};

export default ProgramsPage;
