import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  addParticipant,
  bulkAddParticipants,
  deleteParticipant,
  dropParticipant,
  endParticipantLeave,
  moveParticipantToGroup,
  registerParticipantLeave,
} from "../api/admin/participants";
import { createGroup, listGroups, updateGroup } from "../api/admin/groups";
import {
  downloadActivityLogExcel,
  downloadAttendanceExcel,
  downloadPaymentExcel,
} from "../api/admin/excel";
import { getOrganization } from "../api/admin/organizations";
import { getProgram, listPrograms } from "../api/admin/programs";
import {
  createDemandSite,
  createDemandSiteSchedule,
  deleteDemandSiteSchedule,
  listDemandSites,
  listDemandSiteSchedules,
  updateDemandSite,
} from "../api/admin/demandSites";
import Pagination from "../components/Pagination";

import { usePagination } from "../hooks/usePagination";
import {
  btnPrimaryClass,
  rowActionBtnClass,
  searchInputClass,
  btnGhostClass,
  inputClass,
  selectClass,
} from "../uiClasses";
import type {
  DemandSite,
  DemandSiteSchedule,
  Group,
  Program,
  ProgramWithParticipants,
} from "../types";
import SlideModal from "../components/SlideModal";
import FormField from "../components/FormField";
import { downloadAddParticipantsTemplate } from "../../utils/downloadAddParticipantsTemplate";
import { parseParticipantsFile } from "../../utils/parseParticipantsFile";

const emptyForm = {
  name: "",
  lastPhoneNumber: "",
  demandName: "",
  groupId: "",
};

const emptyGroupForm = {
  name: "",
  description: "",
  shiftStart: "",
  shiftEnd: "",
};

const emptyDemandSiteForm = {
  name: "",
  baseLat: "",
  baseLng: "",
  allowedRadius: "1500",
  address: "",
  contactPerson: "",
};

const emptyScheduleForm = {
  groupId: "",
  shiftStart: "",
  shiftEnd: "",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "활동중",
  ON_LEAVE: "휴무중",
  DROPPED: "참여종료",
};

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
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [exportMonth, setExportMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [demandSites, setDemandSites] = useState<DemandSite[]>([]);
  const [demandSiteSchedules, setDemandSiteSchedules] = useState<
    Record<number, DemandSiteSchedule[]>
  >({});
  const [demandSiteModalOpen, setDemandSiteModalOpen] = useState(false);
  const [editingDemandSiteId, setEditingDemandSiteId] = useState<number | null>(
    null,
  );
  const [demandSiteForm, setDemandSiteForm] = useState(emptyDemandSiteForm);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTargetSiteId, setScheduleTargetSiteId] = useState<
    number | null
  >(null);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);

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

  const filtered = useMemo(
    () =>
      (program?.participants ?? []).filter(
        (p) => p.name.includes(search) || (p.demandName ?? "").includes(search),
      ),
    [program, search],
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

  const handleClickAddButton = () => {
    setForm(emptyForm);
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(emptyForm);
    setSelectedFile(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleSave = async () => {
    try {
      if (selectedFile) {
        const rows = await parseParticipantsFile(selectedFile, activeGroups);
        if (rows.length === 0) {
          alert("파일에서 등록할 참여자를 찾지 못했습니다.");

          return;
        }
        await bulkAddParticipants(programId, { participants: rows });
      } else {
        if (!form.name) {
          alert("이름을 입력해주세요.");

          return;
        }
        if (!/^\d{4}$/.test(form.lastPhoneNumber)) {
          alert("전화번호 뒷 4자리를 숫자 4자리로 입력해주세요.");

          return;
        }
        await addParticipant(programId, {
          name: form.name,
          demandName: form.demandName || undefined,
          phoneLast4: form.lastPhoneNumber,
          groupId: form.groupId ? Number(form.groupId) : undefined,
        });
      }
      closeModal();
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const handleCreateGroup = async () => {
    if (!groupForm.name || !groupForm.shiftStart || !groupForm.shiftEnd) {
      alert("조 이름과 근무시간을 입력해주세요.");

      return;
    }
    try {
      await createGroup(programId, groupForm);
      setGroupModalOpen(false);
      setGroupForm(emptyGroupForm);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "조 등록에 실패했습니다.");
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
    setEditingDemandSiteId(null);
    setDemandSiteForm(emptyDemandSiteForm);
    setDemandSiteModalOpen(true);
  };

  const openEditDemandSite = (site: DemandSite) => {
    setEditingDemandSiteId(site.id);
    setDemandSiteForm({
      name: site.name,
      baseLat: String(site.baseLat),
      baseLng: String(site.baseLng),
      allowedRadius: String(site.allowedRadius),
      address: site.address ?? "",
      contactPerson: site.contactPerson ?? "",
    });
    setDemandSiteModalOpen(true);
  };

  const handleSaveDemandSite = async () => {
    if (
      !demandSiteForm.name ||
      !demandSiteForm.baseLat ||
      !demandSiteForm.baseLng
    ) {
      alert("수요처명과 위도/경도를 입력해주세요.");

      return;
    }
    try {
      const payload = {
        name: demandSiteForm.name,
        baseLat: Number(demandSiteForm.baseLat),
        baseLng: Number(demandSiteForm.baseLng),
        allowedRadius: Number(demandSiteForm.allowedRadius) || undefined,
        address: demandSiteForm.address || undefined,
        contactPerson: demandSiteForm.contactPerson || undefined,
      };
      if (editingDemandSiteId) {
        await updateDemandSite(editingDemandSiteId, payload);
      } else {
        await createDemandSite({ programId, ...payload });
      }
      setDemandSiteModalOpen(false);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
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
    setScheduleForm(emptyScheduleForm);
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (
      !scheduleTargetSiteId ||
      !scheduleForm.groupId ||
      !scheduleForm.shiftStart ||
      !scheduleForm.shiftEnd
    ) {
      alert("조와 근무시간을 입력해주세요.");

      return;
    }
    try {
      await createDemandSiteSchedule(scheduleTargetSiteId, {
        groupId: Number(scheduleForm.groupId),
        shiftStart: scheduleForm.shiftStart,
        shiftEnd: scheduleForm.shiftEnd,
      });
      setScheduleModalOpen(false);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "등록에 실패했습니다.");
    }
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

  const handleLeave = async (participantId: number, name: string) => {
    const leaveStart = prompt(`'${name}' 님의 휴무 시작일 (YYYY-MM-DD)`);
    const leaveEnd = prompt(`'${name}' 님의 휴무 종료일 (YYYY-MM-DD)`);

    if (!leaveStart) return;

    if (!leaveEnd) return;

    try {
      await registerParticipantLeave(participantId, { leaveStart, leaveEnd });
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleEndLeave = async (participantId: number) => {
    try {
      await endParticipantLeave(participantId);
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
          <button className={btnPrimaryClass} onClick={handleClickAddButton}>
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
            onClick={() => {
              setGroupForm(emptyGroupForm);
              setGroupModalOpen(true);
            }}
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
          <input
            className={searchInputClass}
            placeholder="이름 또는 수요처명 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse">
            <thead>
              <tr>
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
                <th className="w-[180px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((participant, index) => (
                <tr key={participant.id} className="hover:bg-[#f8fafc]">
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
                    <select
                      className={selectClass}
                      value={participant.groupId ?? ""}
                      onChange={(event) =>
                        handleAssignGroup(participant.id, event.target.value)
                      }
                    >
                      <option value="">미배정</option>
                      {groups
                        .filter(
                          (group) =>
                            group.isActive || group.id === participant.groupId,
                        )
                        .map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                    </select>
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
                            handleLeave(participant.id, participant.name)
                          }
                        >
                          휴무
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

        <SlideModal
          isOpen={isModalOpen}
          title={"참여자 추가"}
          onClose={closeModal}
          footer={
            <>
              <button className={btnGhostClass} onClick={closeModal}>
                취소
              </button>
              <button className={btnPrimaryClass} onClick={handleSave}>
                저장
              </button>
            </>
          }
        >
          <div className="flex items-center justify-between gap-3 bg-[#f0f6ee] border border-[#d3e6cc] rounded-[2px] px-4 py-3.5">
            <div>
              <div className="text-[13px] font-bold text-[#2f5c25]">
                엑셀로 일괄 등록
              </div>
              <div className="text-xs text-[#5c7a53] mt-0.5">
                양식을 내려받아 작성한 뒤 업로드하세요
              </div>
            </div>
            <button
              className={btnGhostClass}
              onClick={() => downloadAddParticipantsTemplate(activeGroups)}
            >
              양식 다운로드
            </button>
          </div>

          <label
            htmlFor="part-file-input"
            className={`flex flex-col items-center justify-center gap-1.5 border-[1.5px] border-dashed rounded-[2px] py-6 px-4 cursor-pointer text-center hover:bg-[#f7f8fa] ${
              selectedFile
                ? "border-[#1e3a5f] bg-[#f5f8fb]"
                : "border-[#c7cdd6] hover:border-[#9aa5b3]"
            }`}
          >
            <input
              id="part-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <span className="text-lg text-[#6b7280]">⬆</span>
            <span className="text-[13px] font-semibold text-[#374151]">
              {selectedFile ? selectedFile.name : "파일이 선택되지 않았습니다"}
            </span>
            <span className="text-[11.5px] text-[#9aa1ab]">
              {selectedFile
                ? "다른 파일을 선택하려면 다시 클릭하세요"
                : "클릭하여 파일 선택 (xlsx)"}
            </span>
          </label>

          <div className="flex items-center gap-2.5 text-[#9aa1ab] text-[11.5px]">
            <div className="flex-1 h-px bg-[#e2e5eb]" />
            <span>또는 직접 입력</span>
            <div className="flex-1 h-px bg-[#e2e5eb]" />
          </div>

          <FormField label="이름">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) =>
                setForm((f) => ({ ...f, name: event.target.value }))
              }
            />
          </FormField>
          <FormField label="수요처명">
            <input
              className={inputClass}
              value={form.demandName}
              onChange={(event) =>
                setForm((f) => ({ ...f, demandName: event.target.value }))
              }
            />
          </FormField>
          <FormField label="전화번호 뒷자리(4자리)">
            <input
              className={inputClass}
              value={form.lastPhoneNumber}
              maxLength={4}
              inputMode="numeric"
              placeholder="0000"
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  lastPhoneNumber: event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4),
                }))
              }
            />
          </FormField>
          <FormField label="조">
            <select
              className={selectClass + " w-full"}
              value={form.groupId}
              onChange={(event) =>
                setForm((f) => ({ ...f, groupId: event.target.value }))
              }
            >
              <option value="">미배정</option>
              {activeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </FormField>
        </SlideModal>

        <SlideModal
          isOpen={groupModalOpen}
          title="조 추가"
          onClose={() => setGroupModalOpen(false)}
          footer={
            <>
              <button
                className={btnGhostClass}
                onClick={() => setGroupModalOpen(false)}
              >
                취소
              </button>
              <button className={btnPrimaryClass} onClick={handleCreateGroup}>
                저장
              </button>
            </>
          }
        >
          <FormField label="조 이름">
            <input
              className={inputClass}
              value={groupForm.name}
              onChange={(event) =>
                setGroupForm((f) => ({ ...f, name: event.target.value }))
              }
            />
          </FormField>
          <FormField label="설명">
            <input
              className={inputClass}
              value={groupForm.description}
              onChange={(event) =>
                setGroupForm((f) => ({ ...f, description: event.target.value }))
              }
            />
          </FormField>
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="근무 시작시간">
                <input
                  type="time"
                  className={inputClass}
                  value={groupForm.shiftStart}
                  onChange={(event) =>
                    setGroupForm((f) => ({
                      ...f,
                      shiftStart: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="근무 종료시간">
                <input
                  type="time"
                  className={inputClass}
                  value={groupForm.shiftEnd}
                  onChange={(event) =>
                    setGroupForm((f) => ({
                      ...f,
                      shiftEnd: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </div>
        </SlideModal>

        <SlideModal
          isOpen={demandSiteModalOpen}
          title={editingDemandSiteId ? "수요처 수정" : "수요처 추가"}
          onClose={() => setDemandSiteModalOpen(false)}
          footer={
            <>
              <button
                className={btnGhostClass}
                onClick={() => setDemandSiteModalOpen(false)}
              >
                취소
              </button>
              <button
                className={btnPrimaryClass}
                onClick={handleSaveDemandSite}
              >
                저장
              </button>
            </>
          }
        >
          <FormField label="수요처명">
            <input
              className={inputClass}
              value={demandSiteForm.name}
              onChange={(event) =>
                setDemandSiteForm((f) => ({ ...f, name: event.target.value }))
              }
            />
          </FormField>
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="위도">
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  value={demandSiteForm.baseLat}
                  onChange={(event) =>
                    setDemandSiteForm((f) => ({
                      ...f,
                      baseLat: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="경도">
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  value={demandSiteForm.baseLng}
                  onChange={(event) =>
                    setDemandSiteForm((f) => ({
                      ...f,
                      baseLng: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </div>
          <FormField label="반경(m)">
            <input
              type="number"
              className={inputClass}
              value={demandSiteForm.allowedRadius}
              onChange={(event) =>
                setDemandSiteForm((f) => ({
                  ...f,
                  allowedRadius: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="주소">
            <input
              className={inputClass}
              value={demandSiteForm.address}
              onChange={(event) =>
                setDemandSiteForm((f) => ({
                  ...f,
                  address: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="담당자">
            <input
              className={inputClass}
              value={demandSiteForm.contactPerson}
              onChange={(event) =>
                setDemandSiteForm((f) => ({
                  ...f,
                  contactPerson: event.target.value,
                }))
              }
            />
          </FormField>
        </SlideModal>

        <SlideModal
          isOpen={scheduleModalOpen}
          title="근무시간 추가"
          onClose={() => setScheduleModalOpen(false)}
          footer={
            <>
              <button
                className={btnGhostClass}
                onClick={() => setScheduleModalOpen(false)}
              >
                취소
              </button>
              <button className={btnPrimaryClass} onClick={handleSaveSchedule}>
                저장
              </button>
            </>
          }
        >
          <FormField label="조">
            <select
              className={selectClass + " w-full"}
              value={scheduleForm.groupId}
              onChange={(event) =>
                setScheduleForm((f) => ({ ...f, groupId: event.target.value }))
              }
            >
              <option value="">선택하세요</option>
              {activeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="시작시간">
                <input
                  type="time"
                  className={inputClass}
                  value={scheduleForm.shiftStart}
                  onChange={(event) =>
                    setScheduleForm((f) => ({
                      ...f,
                      shiftStart: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="종료시간">
                <input
                  type="time"
                  className={inputClass}
                  value={scheduleForm.shiftEnd}
                  onChange={(event) =>
                    setScheduleForm((f) => ({
                      ...f,
                      shiftEnd: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </div>
        </SlideModal>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
};

export default ProgramDetailPage;
