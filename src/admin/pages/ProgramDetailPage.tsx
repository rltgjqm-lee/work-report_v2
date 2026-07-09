import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  deleteParticipant,
  getOrganization,
  getProgram,
  listPrograms,
} from "../api/client";
import Pagination from "../components/Pagination";

import { usePagination } from "../hooks/usePagination";
import {
  btnPrimaryClass,
  rowActionBtnClass,
  searchInputClass,
  btnGhostClass,
  inputClass,
} from "../uiClasses";
import type { Program, ProgramWithParticipants } from "../types";
import SlideModal from "../components/SlideModal";
import FormField from "../components/FormField";
import { downloadAddParticipantsTemplate } from "../../utils/downloadAddParticipantsTemplate";

const emptyForm = {
  name: "",
  lastPhoneNumber: "",
  demandName: "",
};

const ProgramDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const programId = Number(id);

  const [program, setProgram] = useState<ProgramWithParticipants | null>(null);
  const [orgName, setOrgName] = useState("-");
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    listPrograms().then(setAllPrograms);
  }, []);

  const refresh = () => {
    getProgram(programId).then((full) => {
      setProgram(full);
      getOrganization(full.organizationId).then((org) => setOrgName(org.name));
    });
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
    setIsModalOpen(true);
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
          <table className="w-full min-w-[640px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  번호
                </th>
                <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  이름
                </th>
                <th className="w-[220px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  수요처명
                </th>
                <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  전화번호 뒷자리
                </th>
                <th className="w-[100px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
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
          onClose={() => setIsModalOpen(false)}
          footer={
            <>
              <button
                className={btnGhostClass}
                onClick={() => setIsModalOpen(false)}
              >
                취소
              </button>
              <button
                className={btnPrimaryClass}
                // onClick={handleSave}
              >
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
            className="flex flex-col items-center justify-center gap-1.5 border-[1.5px] border-dashed border-[#c7cdd6] rounded-[2px] py-6 px-4 cursor-pointer text-center hover:bg-[#f7f8fa] hover:border-[#9aa5b3]"
          >
            <input
              id="part-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <span className="text-lg text-[#6b7280]">⬆</span>
            <span className="text-[13px] font-semibold text-[#374151]">
              파일이 선택되지 않았습니다
            </span>
            <span className="text-[11.5px] text-[#9aa1ab]">
              클릭하여 파일 선택 (xlsx)
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
                setForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </FormField>
          <FormField label="전화번호 뒷자리(4자리)">
            <input
              className={inputClass}
              value={form.lastPhoneNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </FormField>
        </SlideModal>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
};

export default ProgramDetailPage;
