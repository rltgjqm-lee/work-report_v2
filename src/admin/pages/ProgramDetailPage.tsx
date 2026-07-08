import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  addParticipant,
  deleteParticipant,
  getOrganization,
  getProgram,
  listPrograms,
} from "../api/client";
import Pagination from "../components/Pagination";
import SlideModal from "../components/SlideModal";
import FormField from "../components/FormField";
import { usePagination } from "../hooks/usePagination";
import {
  btnGhostClass,
  btnPrimaryClass,
  inputClass,
  rowActionBtnClass,
  searchInputClass,
} from "../uiClasses";
import type { Program, ProgramWithParticipants } from "../types";

const ProgramDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const programId = Number(id);

  const [program, setProgram] = useState<ProgramWithParticipants | null>(null);
  const [orgName, setOrgName] = useState("-");
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", demandName: "" });
  const [error, setError] = useState<string | null>(null);

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

  const openAdd = () => {
    setForm({ name: "", demandName: "" });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      await addParticipant(programId, form);
      setModalOpen(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const handleDelete = async (participantId: number, name: string) => {
    if (!confirm(`'${name}' 님을 참여자 명단에서 삭제하시겠습니까?`)) return;
    try {
      await deleteParticipant(programId, participantId);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다.");
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
          <button className={btnPrimaryClass} onClick={openAdd}>
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
          <table className="w-full min-w-[520px] table-fixed border-collapse">
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

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      <SlideModal
        isOpen={modalOpen}
        title="참여자 추가"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              className={btnGhostClass}
              onClick={() => setModalOpen(false)}
            >
              취소
            </button>
            <button className={btnPrimaryClass} onClick={handleSave}>
              저장
            </button>
          </>
        }
      >
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
        {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
      </SlideModal>
    </div>
  );
};

export default ProgramDetailPage;
