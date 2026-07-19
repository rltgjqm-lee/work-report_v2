import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  addParticipant,
  bulkAddParticipants,
  createGroup,
  deleteGroup,
  deleteParticipant,
  downloadActivityLogExcel,
  downloadAttendanceExcel,
  downloadPaymentExcel,
  dropParticipant,
  endParticipantLeave,
  getOrganization,
  getProgram,
  listGroups,
  listPrograms,
  moveParticipantToGroup,
  registerParticipantLeave,
} from "../api/client";
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
import type { Group, Program, ProgramWithParticipants } from "../types";
import SlideModal from "../components/SlideModal";
import FormField from "../components/FormField";
import { downloadAddParticipantsTemplate } from "../../utils/downloadAddParticipantsTemplate";
import { parseParticipantsFile } from "../../utils/parseParticipantsFile";

const emptyForm = {
  name: "",
  lastPhoneNumber: "",
  demandName: "",
};

const emptyGroupForm = {
  name: "",
  description: "",
  shiftStart: "",
  shiftEnd: "",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "활동중",
  ON_LEAVE: "휴무중",
  DROPPED: "탈락",
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

  useEffect(() => {
    listPrograms().then(setAllPrograms);
  }, []);

  const refresh = () => {
    getProgram(programId).then((full) => {
      setProgram(full);
      getOrganization(full.organizationId).then((org) => setOrgName(org.name));
    });
    listGroups(programId).then(setGroups);
  };

  useEffect(refresh, [programId]);

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
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다.");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
  };

  const handleSave = async () => {
    try {
      if (selectedFile) {
        const rows = await parseParticipantsFile(selectedFile);
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
        });
      }
      closeModal();
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장에 실패했습니다.");
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
    } catch (e) {
      alert(e instanceof Error ? e.message : "조 등록에 실패했습니다.");
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    if (!confirm(`'${group.name}' 조를 삭제하시겠습니까?`)) return;

    try {
      await deleteGroup(group.id);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  };

  const handleAssignGroup = async (participantId: number, groupId: string) => {
    try {
      if (groupId) await moveParticipantToGroup(participantId, Number(groupId));
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "조 배정에 실패했습니다.");
    }
  };

  const handleDrop = async (participantId: number, name: string) => {
    const reason = prompt(`'${name}' 님의 탈락 사유를 입력해주세요.`);

    if (reason === null) return;

    try {
      await dropParticipant(participantId, reason || undefined);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "처리에 실패했습니다.");
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
    } catch (e) {
      alert(e instanceof Error ? e.message : "처리에 실패했습니다.");
    }
  };

  const handleEndLeave = async (participantId: number) => {
    try {
      await endParticipantLeave(participantId);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "처리에 실패했습니다.");
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
            onChange={(e) => navigate(`/admin/programs/${e.target.value}`)}
          >
            {allPrograms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-2.5 border border-[#e2e5eb] rounded-[2px] px-3 py-2 text-[13px]"
            >
              <span className="font-semibold">{g.name}</span>
              <span className="text-[#6b7280]">
                {g.shiftStart}~{g.shiftEnd}
              </span>
              <button
                className={rowActionBtnClass}
                onClick={() => handleDeleteGroup(g)}
              >
                삭제
              </button>
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
              onChange={(e) => setExportMonth(e.target.value)}
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
            onChange={(e) => setSearch(e.target.value)}
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
              {pageItems.map((p, idx) => (
                <tr key={p.id} className="hover:bg-[#f8fafc]">
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {(page - 1) * 15 + idx + 1}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {p.name}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {p.demandName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {p.phoneLast4}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    <select
                      className={selectClass}
                      value={p.groupId ?? ""}
                      onChange={(e) => handleAssignGroup(p.id, e.target.value)}
                    >
                      <option value="">미배정</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {statusLabel[p.status]}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {p.status === "ACTIVE" && (
                      <>
                        <button
                          className={rowActionBtnClass}
                          onClick={() => handleLeave(p.id, p.name)}
                        >
                          휴무등록
                        </button>
                        <button
                          className={rowActionBtnClass}
                          onClick={() => handleDrop(p.id, p.name)}
                        >
                          탈락처리
                        </button>
                      </>
                    )}
                    {p.status === "ON_LEAVE" && (
                      <button
                        className={rowActionBtnClass}
                        onClick={() => handleEndLeave(p.id)}
                      >
                        복귀처리
                      </button>
                    )}
                    <button
                      className={rowActionBtnClass}
                      onClick={() => handleDelete(p.id, p.name)}
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
              onClick={downloadAddParticipantsTemplate}
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
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="수요처명">
            <input
              className={inputClass}
              value={form.demandName}
              onChange={(e) =>
                setForm((f) => ({ ...f, demandName: e.target.value }))
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
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  lastPhoneNumber: e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4),
                }))
              }
            />
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
              onChange={(e) =>
                setGroupForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </FormField>
          <FormField label="설명">
            <input
              className={inputClass}
              value={groupForm.description}
              onChange={(e) =>
                setGroupForm((f) => ({ ...f, description: e.target.value }))
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
                  onChange={(e) =>
                    setGroupForm((f) => ({ ...f, shiftStart: e.target.value }))
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
                  onChange={(e) =>
                    setGroupForm((f) => ({ ...f, shiftEnd: e.target.value }))
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
