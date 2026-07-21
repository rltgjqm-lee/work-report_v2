import { useEffect, useMemo, useState } from "react";

import { deleteParticipant } from "../api/admin/participants";
import { getProgram, listPrograms } from "../api/admin/programs";
import { listOrganizations } from "../api/admin/organizations";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";
import FilterSelect from "../components/FilterSelect";
import { usePagination } from "../hooks/usePagination";
import { rowActionBtnClass } from "../uiClasses";
import type { Participant, Program } from "../types";

type ParticipantRow = Participant & {
  programName: string;
  organizationName: string;
};

/**
 * 관리자 페이지 > 참여자 관리 페이지입니다.
 *
 */
const ParticipantsPage = () => {
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programFilter, setProgramFilter] = useState("all");
  const [search, setSearch] = useState("");

  const refresh = () => {
    Promise.all([listPrograms(), listOrganizations()]).then(
      ([programList, orgList]) => {
        setPrograms(programList);

        const orgNameById = new Map(
          orgList.map((organization) => [organization.id, organization.name]),
        );

        Promise.all(programList.map((program) => getProgram(program.id))).then(
          (fullPrograms) => {
            const allRows: ParticipantRow[] = fullPrograms.flatMap(
              (fullProgram) =>
                fullProgram.participants.map((participant) => ({
                  ...participant,
                  programName: fullProgram.name,
                  organizationName:
                    orgNameById.get(fullProgram.organizationId) ?? "-",
                })),
            );
            setRows(allRows);
          },
        );
      },
    );
  };

  useEffect(refresh, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (programFilter !== "all") {
      list = list.filter(
        (participantRow) => participantRow.programId === Number(programFilter),
      );
    }
    if (search) {
      list = list.filter(
        (participantRow) =>
          participantRow.name.includes(search) ||
          (participantRow.demandName ?? "").includes(search),
      );
    }
    return list;
  }, [rows, programFilter, search]);

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, 15);

  const handleDelete = async (row: ParticipantRow) => {
    if (!confirm(`'${row.name}' 님을 삭제하시겠습니까?`)) return;
    try {
      await deleteParticipant(row.programId, row.id);
      alert(`'${row.name}' 님을 삭제했습니다.`);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold m-0">참여자 관리</h1>
          <p className="text-[13px] text-[#6b7280] mt-1.5">
            전체 사업단의 참여 어르신을 통합 조회합니다.
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
          <div className="flex items-center gap-2.5">
            <FilterSelect
              value={programFilter}
              onChange={(value) => {
                setProgramFilter(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "전체 사업단" },
                ...programs.map((program) => ({
                  value: String(program.id),
                  label: program.name,
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
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[130px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  이름
                </th>
                <th className="w-[220px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  수요처명
                </th>
                <th className="w-[230px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  소속 사업단
                </th>
                <th className="w-[170px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  소속기관
                </th>
                <th className="w-[70px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id} className="hover:bg-[#f8fafc]">
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {row.name}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {row.demandName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {row.programName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {row.organizationName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    <button
                      className={rowActionBtnClass}
                      onClick={() => handleDelete(row)}
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
