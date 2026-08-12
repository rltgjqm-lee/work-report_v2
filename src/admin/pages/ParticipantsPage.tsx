import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteParticipantMutationOptions } from "../api/admin/participants";
import { programQueryOptions, programsQueryOptions } from "../api/admin/programs";
import { organizationsQueryOptions } from "../api/admin/organizations";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";
import FilterSelect from "../components/FilterSelect";
import { usePagination } from "../hooks/usePagination";
import { useToast } from "../context/useToast";
import { rowActionBtnClass } from "../uiClasses";
import type { Participant } from "../types/participants";

type ParticipantRow = Participant & {
  programName: string;
  programType: string | null;
  organizationName: string;
};

const DEMAND_SITE = {
  ALL: "all",
  UNASSIGNED: "unassigned",
} as const;

const PROGRAM_FILTER = {
  ALL: "all",
} as const;

/**
 * 관리자 페이지 > 참여자 관리 페이지입니다.
 *
 */
const ParticipantsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [programTypeFilter, setProgramTypeFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState<string>(PROGRAM_FILTER.ALL);
  const [demandSiteFilter, setDemandSiteFilter] = useState<string>(DEMAND_SITE.ALL);
  const [search, setSearch] = useState("");

  const { data: programs = [] } = useQuery(programsQueryOptions);
  const { data: organizations = [] } = useQuery(organizationsQueryOptions);
  const programQueries = useQueries({
    queries: programs.map((program) => programQueryOptions(program.id)),
  });

  const filteredPrograms = useMemo(
    () =>
      programTypeFilter === "all"
        ? programs
        : programs.filter((program) => program.programType === programTypeFilter),
    [programs, programTypeFilter],
  );

  const OrganizationNameById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations],
  );

  const rows: ParticipantRow[] = useMemo(
    () =>
      programQueries.flatMap((programQuery) => {
        const fullProgram = programQuery.data;
        if (!fullProgram) return [];

        return fullProgram.participants.map((participant) => ({
          ...participant,
          programName: fullProgram.name,
          programType: fullProgram.programType,
          organizationName: OrganizationNameById.get(fullProgram.organizationId) ?? "-",
        }));
      }),
    [programQueries, OrganizationNameById],
  );

  // 수요처는 사업단마다 다르므로, 선택한 사업단에 실제로 있는 수요처만 후보로 올린다.
  // 참여자 행이 들고 있는 이름(demandName)을 그대로 쓰므로 별도 조회가 필요 없다.
  const demandSiteNames = useMemo(() => {
    let scopedRows =
      programTypeFilter === "all"
        ? rows
        : rows.filter((participantRow) => participantRow.programType === programTypeFilter);

    if (programFilter !== PROGRAM_FILTER.ALL) {
      scopedRows = scopedRows.filter(
        (participantRow) => participantRow.programId === Number(programFilter),
      );
    }

    return [
      ...new Set(
        scopedRows
          .map((participantRow) => participantRow.demandName)
          .filter((demandName): demandName is string => !!demandName),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [rows, programFilter, programTypeFilter]);

  const filtered = useMemo(() => {
    let list = rows;

    if (programTypeFilter !== "all") {
      list = list.filter((participantRow) => participantRow.programType === programTypeFilter);
    }

    if (programFilter !== PROGRAM_FILTER.ALL) {
      list = list.filter((participantRow) => participantRow.programId === Number(programFilter));
    }

    if (demandSiteFilter === DEMAND_SITE.UNASSIGNED) {
      list = list.filter((participantRow) => !participantRow.demandName);
    } else if (demandSiteFilter !== DEMAND_SITE.ALL) {
      list = list.filter((participantRow) => participantRow.demandName === demandSiteFilter);
    }

    if (search) {
      list = list.filter(
        (participantRow) =>
          participantRow.name.includes(search) ||
          (participantRow.demandName ?? "").includes(search),
      );
    }
    return list;
  }, [rows, programTypeFilter, programFilter, demandSiteFilter, search]);

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, 15);

  const deleteParticipantMutation = useMutation(deleteParticipantMutationOptions(queryClient));

  const handleDeleteButtonClick = (row: ParticipantRow) => {
    if (!confirm(`'${row.name}' 님을 삭제하시겠습니까?`)) return;

    deleteParticipantMutation.mutate(
      { programId: row.programId, participantId: row.id, name: row.name },
      {
        onSuccess: () => showToast(`'${row.name}' 님을 삭제했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "삭제에 실패했습니다."),
      },
    );
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold m-0">참여자 관리</h1>
          <p className="text-[13px] text-text-subtle mt-1.5">
            전체 사업단의 참여자를 통합 조회합니다.
          </p>
        </div>
      </div>

      <div className="bg-white border border-admin-border-subtle rounded-[2px]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-faint flex-wrap">
          <div className="flex items-center gap-2.5">
            <FilterSelect
              value={programTypeFilter}
              onChange={(value) => {
                setProgramTypeFilter(value);
                setProgramFilter(PROGRAM_FILTER.ALL);
                setDemandSiteFilter(DEMAND_SITE.ALL);
                setPage(1);
              }}
              options={[
                { value: "all", label: "전체 유형" },
                { value: "공익 활동", label: "공익 활동" },
                { value: "역량 활동", label: "역량 활동" },
              ]}
            />
            <FilterSelect
              value={programFilter}
              onChange={(value) => {
                setProgramFilter(value);
                setDemandSiteFilter(DEMAND_SITE.ALL);
                setPage(1);
              }}
              options={[
                { value: PROGRAM_FILTER.ALL, label: "전체 사업단" },
                ...filteredPrograms.map((program) => ({
                  value: String(program.id),
                  label: program.name,
                })),
              ]}
            />
            <FilterSelect
              value={demandSiteFilter}
              onChange={(value) => {
                setDemandSiteFilter(value);
                setPage(1);
              }}
              options={[
                { value: DEMAND_SITE.ALL, label: "전체 수요처" },
                {
                  value: DEMAND_SITE.UNASSIGNED,
                  label: "수요처 미배정",
                },
                ...demandSiteNames.map((demandSiteName) => ({
                  value: demandSiteName,
                  label: demandSiteName,
                })),
              ]}
            />
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="이름 또는 수요처명 검색"
            />
          </div>
          <span className="text-xs text-text-subtle font-medium whitespace-nowrap">
            총 {filtered.length}명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[130px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  이름
                </th>
                <th className="w-[60px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  성별
                </th>
                <th className="w-[170px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  소속기관
                </th>
                <th className="w-[230px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  소속 사업단
                </th>
                <th className="w-[220px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  수요처명
                </th>
                <th className="w-[70px] bg-admin-surface-header border-b border-admin-border-subtle" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-admin-row-hover cursor-pointer"
                  onClick={() => navigate(`/admin/participants/${row.id}`)}
                >
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    {row.name}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    {row.gender ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    {row.organizationName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    {row.programName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-normal break-words">
                    {row.demandName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    <button
                      className={rowActionBtnClass}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteButtonClick(row);
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
};

export default ParticipantsPage;
