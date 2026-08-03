import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { groupsQueryOptions } from "../../api/admin/groups";
import { organizationQueryOptions } from "../../api/admin/organizations";
import { programQueryOptions, programsQueryOptions } from "../../api/admin/programs";
import {
  demandSitesQueryOptions,
  demandSiteSchedulesQueryOptions,
} from "../../api/admin/demandSites";
import ProgramGroupsSection from "./ProgramGroupsSection";
import ProgramDemandSitesSection from "./ProgramDemandSitesSection";
import ProgramExcelExportSection from "./ProgramExcelExportSection";
import ProgramParticipantsSection from "./ProgramParticipantsSection";
import ParticipantAddModal from "./ParticipantAddModal";
import ProgramTypeChip from "../../components/chip/ProgramTypeChip";
import TabBar from "../../components/bar/TabBar";

import { btnPrimaryClass, btnGhostClass } from "../../uiClasses";

const PROGRAM_DETAIL_TAB = {
  GROUPS: "groups",
  DEMAND_SITES: "demandSites",
  PARTICIPANTS: "participants",
  EXCEL: "excel",
} as const;

type Tab = (typeof PROGRAM_DETAIL_TAB)[keyof typeof PROGRAM_DETAIL_TAB];

const PROGRAM_DETAIL_TABS: [Tab, string][] = [
  [PROGRAM_DETAIL_TAB.DEMAND_SITES, "수요처 관리"],
  [PROGRAM_DETAIL_TAB.GROUPS, "조 관리"],
  [PROGRAM_DETAIL_TAB.PARTICIPANTS, "참여자 명단"],
  [PROGRAM_DETAIL_TAB.EXCEL, "양식 출력"],
];

/**
 * 관리자 페이지 > 사업단 상세 페이지입니다.
 *
 */
const ProgramDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const programId = Number(id);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [demandFilter, setDemandFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(PROGRAM_DETAIL_TAB.DEMAND_SITES);

  const { data: allPrograms = [] } = useQuery(programsQueryOptions);
  const { data: program } = useQuery(programQueryOptions(programId));
  const { data: organization } = useQuery({
    ...organizationQueryOptions(program?.organizationId ?? 0),
    enabled: !!program,
  });
  const { data: groups = [] } = useQuery(groupsQueryOptions(programId));
  const { data: demandSites = [] } = useQuery(demandSitesQueryOptions(programId));
  const demandSiteScheduleQueries = useQueries({
    queries: demandSites.map((demandSite) => demandSiteSchedulesQueryOptions(demandSite.id)),
  });

  const organizationName = organization?.name ?? "-";

  const demandSiteSchedules = useMemo(
    () =>
      Object.fromEntries(
        demandSites.map((demandSite, index) => [
          demandSite.id,
          demandSiteScheduleQueries[index]?.data ?? [],
        ]),
      ),
    [demandSites, demandSiteScheduleQueries],
  );

  const activeGroups = useMemo(() => groups.filter((group) => group.isActive), [groups]);

  const activeDemandSites = useMemo(
    () => demandSites.filter((demandSite) => demandSite.isActive),
    [demandSites],
  );

  const demandOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (program?.participants ?? [])
            .map((participant) => participant.demandName)
            .filter((demandName): demandName is string => Boolean(demandName)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [program],
  );

  const filtered = useMemo(
    () =>
      (program?.participants ?? []).filter((participant) => {
        const matchesSearch = participant.name.includes(search);
        const matchesStatus = statusFilter === "all" || participant.status === statusFilter;
        const matchesGroup = groupFilter === "all" || participant.groupId === Number(groupFilter);
        const matchesDemand = demandFilter === "all" || participant.demandName === demandFilter;
        return matchesSearch && matchesStatus && matchesGroup && matchesDemand;
      }),
    [program, search, statusFilter, groupFilter, demandFilter],
  );

  if (!program) return null;

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-xs text-[#6b7280] mb-1.5">
            사업단 관리 /{" "}
            <a
              onClick={() => navigate("/admin/programs")}
              className="cursor-pointer text-[#1e3a5f] hover:text-[#132a45]"
            >
              목록으로
            </a>
          </div>
          <h1 className="text-[21px] font-bold m-0 flex items-center gap-2.5">
            {program.name}
            <ProgramTypeChip programType={program.programType} />
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-1.5">
            사업단에 참여하는 참여자 명단을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <select
            className="border border-[#d7dbe1] px-3 py-2 text-[13px] rounded-[2px] bg-white"
            value={programId}
            onChange={(event) => navigate(`/admin/programs/${event.target.value}`)}
          >
            {allPrograms.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <button
            className={btnGhostClass}
            onClick={() => navigate(`/admin/programs/${programId}/attendance`)}
          >
            근태 관리
          </button>

          <button
            className={btnGhostClass}
            onClick={() => navigate(`/admin/programs/${programId}/escapes`)}
          >
            안전 관제
          </button>

          <button className={btnPrimaryClass} onClick={() => setIsModalOpen(true)}>
            + 참여자 추가
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 mb-5">
        <div className="px-5 py-4 border border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">소속기관</div>
          <div className="text-sm font-bold">{organizationName}</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">사업기간</div>
          <div className="text-sm font-bold">
            {program.startDate} ~ {program.endDate}
          </div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">운영시간</div>
          <div className="text-sm font-bold">
            {program.startTime} ~ {program.endTime}
          </div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">참여자수</div>
          <div className="text-sm font-bold">{filtered.length}명</div>
        </div>
      </div>

      <TabBar tabs={PROGRAM_DETAIL_TABS} active={tab} onChange={setTab} />

      {tab === PROGRAM_DETAIL_TAB.GROUPS && (
        <ProgramGroupsSection
          programId={programId}
          groups={groups}
          programEndDate={program.endDate}
        />
      )}

      {tab === PROGRAM_DETAIL_TAB.DEMAND_SITES && (
        <ProgramDemandSitesSection
          programId={programId}
          demandSites={demandSites}
          demandSiteSchedules={demandSiteSchedules}
          groups={groups}
        />
      )}

      {tab === PROGRAM_DETAIL_TAB.PARTICIPANTS && (
        <ProgramParticipantsSection
          programId={programId}
          participants={filtered}
          groups={groups}
          search={search}
          onSearchChange={setSearch}
          demandOptions={demandOptions}
          demandFilter={demandFilter}
          onDemandFilterChange={setDemandFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          groupFilter={groupFilter}
          onGroupFilterChange={setGroupFilter}
        />
      )}

      {tab === PROGRAM_DETAIL_TAB.EXCEL && (
        <ProgramExcelExportSection programId={programId} programType={program.programType} />
      )}

      {isModalOpen && (
        <ParticipantAddModal
          onClose={() => setIsModalOpen(false)}
          programId={programId}
          activeGroups={activeGroups}
          activeDemandSites={activeDemandSites}
        />
      )}
    </div>
  );
};

export default ProgramDetailPage;
