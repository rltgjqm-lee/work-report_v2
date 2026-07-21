import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  deleteParticipant,
  dropParticipant,
  endParticipantLeave,
  moveParticipantToGroup,
  reactivateParticipant,
  bulkUpdateParticipantStatus,
} from "../api/admin/participants";
import { listGroups, updateGroup } from "../api/admin/groups";
import {
  downloadActivityLogExcel,
  downloadAttendanceExcel,
  downloadPaymentExcel,
} from "../api/admin/excel";
import { getOrganization } from "../api/admin/organizations";
import { getProgram, listPrograms } from "../api/admin/programs";
import {
  deleteDemandSiteSchedule,
  listDemandSites,
  listDemandSiteSchedules,
  updateDemandSite,
} from "../api/admin/demandSites";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";
import FilterSelect from "../components/FilterSelect";
import ParticipantAddModal from "../components/modals/ParticipantAddModal";
import GroupAddModal from "../components/modals/GroupAddModal";
import DemandSiteFormModal from "../components/modals/DemandSiteFormModal";
import DemandSiteScheduleAddModal from "../components/modals/DemandSiteScheduleAddModal";
import ParticipantLeaveAddModal from "../components/modals/ParticipantLeaveAddModal";
import AnnualLeaveModal from "../components/modals/AnnualLeaveModal";

import { usePagination } from "../hooks/usePagination";
import {
  btnPrimaryClass,
  rowActionBtnClass,
  btnGhostClass,
  inputClass,
} from "../uiClasses";
import type {
  DemandSite,
  DemandSiteSchedule,
  Group,
  Program,
  ProgramWithParticipants,
} from "../types";

const statusLabel: Record<string, string> = {
  ACTIVE: "활동중",
  ON_LEAVE: "휴무중",
  DROPPED: "참여종료",
};

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
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [demandSites, setDemandSites] = useState<DemandSite[]>([]);
  const [demandSiteSchedules, setDemandSiteSchedules] = useState<
    Record<number, DemandSiteSchedule[]>
  >({});
  const [demandSiteModalOpen, setDemandSiteModalOpen] = useState(false);
  const [editingDemandSite, setEditingDemandSite] = useState<DemandSite | null>(
    null,
  );
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTargetSiteId, setScheduleTargetSiteId] = useState<
    number | null
  >(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    number[]
  >([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [annualModalOpen, setAnnualModalOpen] = useState(false);
  const [annualTarget, setAnnualTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

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

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, 15);

  const handleDelete = async (participantId: number, name: string) => {
    if (!confirm(`'${name}' 님을 참여자 명단에서 삭제하시겠습니까?`)) return;
    try {
      await deleteParticipant(programId, participantId);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  const handleToggleGroupActive = async (group: Group) => {
    const actionLabel = group.isActive ? "비활성화" : "활성화";
    if (!confirm(`'${group.name}' 조를 ${actionLabel}하시겠습니까?`)) return;

    try {
      await updateGroup(group.id, { isActive: !group.isActive });
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const openAddDemandSite = () => {
    setEditingDemandSite(null);
    setDemandSiteModalOpen(true);
  };

  const openEditDemandSite = (site: DemandSite) => {
    setEditingDemandSite(site);
    setDemandSiteModalOpen(true);
  };

  const handleToggleDemandSiteActive = async (site: DemandSite) => {
    const actionLabel = site.isActive ? "비활성화" : "활성화";
    if (!confirm(`'${site.name}' 수요처를 ${actionLabel}하시겠습니까?`)) return;

    try {
      await updateDemandSite(site.id, { isActive: !site.isActive });
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const openAddSchedule = (siteId: number) => {
    setScheduleTargetSiteId(siteId);
    setScheduleModalOpen(true);
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!confirm("이 근무시간을 삭제하시겠습니까?")) return;

    try {
      await deleteDemandSiteSchedule(scheduleId);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  const handleAssignGroup = async (participantId: number, groupId: string) => {
    try {
      if (groupId) await moveParticipantToGroup(participantId, Number(groupId));
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "조 배정에 실패했습니다.");
    }
  };

  const handleDrop = async (participantId: number, name: string) => {
    const reason = prompt(`'${name}' 님의 참여종료 사유를 입력해주세요.`);

    if (reason === null) return;

    try {
      await dropParticipant(participantId, reason || undefined);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const openLeaveModal = (participantId: number, name: string) => {
    setLeaveTarget({ id: participantId, name });
    setLeaveModalOpen(true);
  };

  const handleEndLeave = async (participantId: number) => {
    try {
      await endParticipantLeave(participantId);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleReactivate = async (participantId: number, name: string) => {
    if (!confirm(`'${name}' 님을 다시 활동중 상태로 되돌리시겠습니까?`)) return;

    try {
      await reactivateParticipant(participantId);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const openAnnualModal = (participantId: number, name: string) => {
    setAnnualTarget({ id: participantId, name });
    setAnnualModalOpen(true);
  };

  const toggleParticipantSelected = (participantId: number) => {
    setSelectedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
  };

  const handleBulkDrop = async () => {
    const reason = prompt("일괄 참여종료 사유를 입력해주세요.");
    if (reason === null) return;

    try {
      await bulkUpdateParticipantStatus(programId, {
        participantIds: selectedParticipantIds,
        status: "DROPPED",
        dropReason: reason || undefined,
      });
      setSelectedParticipantIds([]);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleBulkReactivate = async () => {
    if (
      !confirm(
        `선택한 ${selectedParticipantIds.length}명을 재활성화하시겠습니까?`,
      )
    )
      return;

    try {
      await bulkUpdateParticipantStatus(programId, {
        participantIds: selectedParticipantIds,
        status: "ACTIVE",
      });
      setSelectedParticipantIds([]);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

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

      <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1]">
          <span className="text-sm font-bold">조 관리</span>
          <button
            className={btnGhostClass}
            onClick={() => setGroupModalOpen(true)}
          >
            + 조 추가
          </button>
        </div>
        <div className="flex flex-wrap gap-2.5 px-5 py-4">
          {groups.length === 0 && (
            <span className="text-[13px] text-[#9aa1ab]">
              등록된 조가 없습니다.
            </span>
          )}
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center gap-2.5 border border-[#e2e5eb] rounded-[2px] px-3 py-2 text-[13px]"
            >
              <span className="font-semibold">{group.name}</span>
              <span className="text-[#6b7280]">
                {group.shiftStart}~{group.shiftEnd}
              </span>
              <span className="text-[#9aa1ab]">{group.participantCount}명</span>
              <span className="text-[#9aa1ab]">
                {group.isActive ? "활성" : "비활성"}
              </span>
              <button
                className={rowActionBtnClass}
                onClick={() => handleToggleGroupActive(group)}
              >
                {group.isActive ? "비활성화" : "활성화"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1]">
          <span className="text-sm font-bold">수요처 관리</span>
          <button className={btnGhostClass} onClick={openAddDemandSite}>
            + 수요처 추가
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          {demandSites.length === 0 && (
            <span className="text-[13px] text-[#9aa1ab]">
              등록된 수요처가 없습니다.
            </span>
          )}
          {demandSites.map((site) => (
            <div
              key={site.id}
              className="border border-[#e2e5eb] rounded-[2px] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="font-semibold text-[13px]">{site.name}</span>
                  <span className="ml-2 text-xs text-[#6b7280]">
                    {site.isActive ? "활성" : "비활성"}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    className={rowActionBtnClass}
                    onClick={() => openEditDemandSite(site)}
                  >
                    수정
                  </button>
                  <button
                    className={rowActionBtnClass}
                    onClick={() => handleToggleDemandSiteActive(site)}
                  >
                    {site.isActive ? "비활성화" : "활성화"}
                  </button>
                </div>
              </div>
              <div className="text-xs text-[#6b7280] mt-1">
                {site.address && <span>{site.address} · </span>}
                위경도 {site.baseLat}, {site.baseLng} (반경 {site.allowedRadius}
                m)
                {site.contactPerson && (
                  <span> · 담당자 {site.contactPerson}</span>
                )}
              </div>
              <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
                {(demandSiteSchedules[site.id] ?? []).map((schedule) => (
                  <span
                    key={schedule.id}
                    className="flex items-center gap-1.5 border border-[#e2e5eb] rounded-[2px] px-2.5 py-1 text-[12.5px]"
                  >
                    {schedule.groupName} {schedule.shiftStart}~
                    {schedule.shiftEnd}
                    <button
                      className="bg-transparent border-none text-[#9aa1ab] cursor-pointer hover:text-[#b42318]"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  className={rowActionBtnClass}
                  onClick={() => openAddSchedule(site.id)}
                >
                  + 근무시간
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
          <span className="text-sm font-bold">엑셀 출력</span>
          <div className="flex items-center gap-2.5">
            <input
              type="month"
              className={inputClass}
              value={exportMonth}
              onChange={(event) => setExportMonth(event.target.value)}
            />
            <button
              className={btnGhostClass}
              onClick={() => downloadActivityLogExcel(programId, exportMonth)}
            >
              활동일지
            </button>
            <button
              className={btnGhostClass}
              onClick={() => downloadAttendanceExcel(programId, exportMonth)}
            >
              출근부
            </button>
            <button
              className={btnGhostClass}
              onClick={() => downloadPaymentExcel(programId, exportMonth)}
            >
              급여대장
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="이름 또는 수요처명 검색"
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "전체 상태" },
                { value: "ACTIVE", label: "활동중" },
                { value: "ON_LEAVE", label: "휴무중" },
                { value: "DROPPED", label: "참여종료" },
              ]}
            />
            <FilterSelect
              value={groupFilter}
              onChange={setGroupFilter}
              options={[
                { value: "all", label: "전체 조" },
                ...groups.map((group) => ({
                  value: String(group.id),
                  label: group.name,
                })),
              ]}
            />
          </div>
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}명
          </span>
        </div>

        {selectedParticipantIds.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#eceef1] bg-[#f5f8fb]">
            <span className="text-xs text-[#1e3a5f] font-semibold">
              {selectedParticipantIds.length}명 선택됨
            </span>
            <button className={rowActionBtnClass} onClick={handleBulkDrop}>
              일괄 참여종료
            </button>
            <button
              className={rowActionBtnClass}
              onClick={handleBulkReactivate}
            >
              일괄 재활성화
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[40px] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]" />
                <th className="w-[70px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  번호
                </th>
                <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  이름
                </th>
                <th className="w-[180px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  수요처명
                </th>
                <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  전화번호
                </th>
                <th className="w-[130px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  조
                </th>
                <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  상태
                </th>
                <th className="w-[260px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((participant, index) => (
                <tr key={participant.id} className="hover:bg-[#f8fafc]">
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    <input
                      type="checkbox"
                      checked={selectedParticipantIds.includes(participant.id)}
                      onChange={() => toggleParticipantSelected(participant.id)}
                    />
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {(page - 1) * 15 + index + 1}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {participant.name}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {participant.demandName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {participant.phoneLast4}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    <FilterSelect
                      value={String(participant.groupId ?? "")}
                      onChange={(value) =>
                        handleAssignGroup(participant.id, value)
                      }
                      options={[
                        { value: "", label: "미배정" },
                        ...groups
                          .filter(
                            (group) =>
                              group.isActive ||
                              group.id === participant.groupId,
                          )
                          .map((group) => ({
                            value: String(group.id),
                            label: group.name,
                          })),
                      ]}
                    />
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {statusLabel[participant.status]}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {participant.status === "ACTIVE" && (
                      <>
                        <button
                          className={rowActionBtnClass}
                          onClick={() =>
                            openLeaveModal(participant.id, participant.name)
                          }
                        >
                          휴무
                        </button>
                        <button
                          className={rowActionBtnClass}
                          onClick={() =>
                            openAnnualModal(participant.id, participant.name)
                          }
                        >
                          연차설정
                        </button>
                        <button
                          className={rowActionBtnClass}
                          onClick={() =>
                            handleDrop(participant.id, participant.name)
                          }
                        >
                          참여종료
                        </button>
                      </>
                    )}
                    {participant.status === "ON_LEAVE" && (
                      <button
                        className={rowActionBtnClass}
                        onClick={() => handleEndLeave(participant.id)}
                      >
                        복귀
                      </button>
                    )}
                    {participant.status === "DROPPED" && (
                      <button
                        className={rowActionBtnClass}
                        onClick={() =>
                          handleReactivate(participant.id, participant.name)
                        }
                      >
                        재활성화
                      </button>
                    )}
                    <button
                      className={rowActionBtnClass}
                      onClick={() =>
                        handleDelete(participant.id, participant.name)
                      }
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

        {groupModalOpen && (
          <GroupAddModal
            onClose={() => setGroupModalOpen(false)}
            onSaved={() => {
              setGroupModalOpen(false);
              refresh();
            }}
            programId={programId}
          />
        )}

        {demandSiteModalOpen && (
          <DemandSiteFormModal
            onClose={() => setDemandSiteModalOpen(false)}
            onSaved={() => {
              setDemandSiteModalOpen(false);
              refresh();
            }}
            programId={programId}
            editingDemandSite={editingDemandSite}
          />
        )}

        {scheduleModalOpen && (
          <DemandSiteScheduleAddModal
            onClose={() => setScheduleModalOpen(false)}
            onSaved={() => {
              setScheduleModalOpen(false);
              refresh();
            }}
            targetSiteId={scheduleTargetSiteId}
            activeGroups={activeGroups}
          />
        )}

        {leaveModalOpen && (
          <ParticipantLeaveAddModal
            onClose={() => setLeaveModalOpen(false)}
            onSaved={() => {
              setLeaveModalOpen(false);
              refresh();
            }}
            target={leaveTarget}
          />
        )}

        {annualModalOpen && (
          <AnnualLeaveModal
            onClose={() => setAnnualModalOpen(false)}
            onSaved={refresh}
            target={annualTarget}
          />
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
};

export default ProgramDetailPage;
