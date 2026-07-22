import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { listGroups } from "../../api/admin/groups";
import { getOrganization } from "../../api/admin/organizations";
import { getProgram, listPrograms } from "../../api/admin/programs";
import {
  listDemandSites,
  listDemandSiteSchedules,
} from "../../api/admin/demandSites";
import ProgramGroupsSection from "./ProgramGroupsSection";
import ProgramDemandSitesSection from "./ProgramDemandSitesSection";
import ProgramExcelExportSection from "./ProgramExcelExportSection";
import ProgramParticipantsSection from "./ProgramParticipantsSection";
import ParticipantAddModal from "./ParticipantAddModal";

import { btnPrimaryClass, btnGhostClass } from "../../uiClasses";
import type {
  DemandSite,
  DemandSiteSchedule,
  Group,
  Program,
  ProgramWithParticipants,
} from "../../types";

/**
 * 관리자 페이지 > 사업단 상세 페이지입니다.
 *
 */
const ProgramDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const programId = Number(id);

  const [program, setProgram] = useState<ProgramWithParticipants | null>(null);
  const [orgName, setOrgName] = useState("-");
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [demandSites, setDemandSites] = useState<DemandSite[]>([]);
  const [demandSiteSchedules, setDemandSiteSchedules] = useState<
    Record<number, DemandSiteSchedule[]>
  >({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );

  useEffect(() => {
    listPrograms().then(setAllPrograms);
  }, []);

  const refresh = () => {
    getProgram(programId).then((full) => {
      setProgram(full);
      getOrganization(full.organizationId).then((org) => setOrgName(org.name));
    });
    listGroups(programId).then(setGroups);
    listDemandSites(programId).then((sites) => {
      setDemandSites(sites);
      Promise.all(
        sites.map((site) =>
          listDemandSiteSchedules(site.id).then(
            (schedules) => [site.id, schedules] as const,
          ),
        ),
      ).then((pairs) => setDemandSiteSchedules(Object.fromEntries(pairs)));
    });
  };

  useEffect(refresh, [programId]);

  const activeGroups = useMemo(
    () => groups.filter((group) => group.isActive),
    [groups],
  );

  const activeDemandSites = useMemo(
    () => demandSites.filter((demandSite) => demandSite.isActive),
    [demandSites],
  );

  const filtered = useMemo(
    () =>
      (program?.participants ?? []).filter((participant) => {
        const matchesSearch =
          participant.name.includes(search) ||
          (participant.demandName ?? "").includes(search);
        const matchesStatus =
          statusFilter === "all" || participant.status === statusFilter;
        const matchesGroup =
          groupFilter === "all" || participant.groupId === Number(groupFilter);
        return matchesSearch && matchesStatus && matchesGroup;
      }),
    [program, search, statusFilter, groupFilter],
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
          <h1 className="text-[21px] font-bold m-0">{program.name}</h1>
          <p className="text-[13px] text-[#6b7280] mt-1.5">
            사업단에 참여하는 어르신 명단을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <select
            className="border border-[#d7dbe1] px-3 py-2 text-[13px] rounded-[2px] bg-white"
            value={programId}
            onChange={(event) =>
              navigate(`/admin/programs/${event.target.value}`)
            }
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
            근태 조회
          </button>
          <button
            className={btnGhostClass}
            onClick={() => navigate(`/admin/programs/${programId}/leaves`)}
          >
            휴가 현황
          </button>
          <button
            className={btnGhostClass}
            onClick={() => navigate(`/admin/programs/${programId}/escapes`)}
          >
            이탈 관제
          </button>
          <button
            className={btnPrimaryClass}
            onClick={() => setIsModalOpen(true)}
          >
            + 참여자 추가
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 mb-5">
        <div className="px-5 py-4 border border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            소속기관
          </div>
          <div className="text-sm font-bold">{orgName}</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            사업기간
          </div>
          <div className="text-sm font-bold">
            {program.startDate} ~ {program.endDate}
          </div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            운영시간
          </div>
          <div className="text-sm font-bold">
            {program.startTime} ~ {program.endTime}
          </div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            참여자수
          </div>
          <div className="text-sm font-bold">{filtered.length}명</div>
        </div>
      </div>

      <ProgramGroupsSection
        programId={programId}
        groups={groups}
        onChanged={refresh}
      />

      <ProgramDemandSitesSection
        programId={programId}
        demandSites={demandSites}
        demandSiteSchedules={demandSiteSchedules}
        groups={groups}
        onChanged={refresh}
      />

      <ProgramExcelExportSection
        programId={programId}
        exportMonth={exportMonth}
        onExportMonthChange={setExportMonth}
      />

      <ProgramParticipantsSection
        programId={programId}
        participants={filtered}
        groups={groups}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
        onChanged={refresh}
      />

      {isModalOpen && (
        <ParticipantAddModal
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false);
            refresh();
          }}
          programId={programId}
          activeGroups={activeGroups}
          activeDemandSites={activeDemandSites}
        />
      )}
    </div>
  );
};

export default ProgramDetailPage;
