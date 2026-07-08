import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createProgram,
  deleteProgram,
  getProgram,
  listOrganizations,
  listPrograms,
  updateProgram,
} from "../api/client";
import Pagination from "../components/Pagination";
import SlideModal from "../components/SlideModal";
import FormField from "../components/FormField";
import { usePagination } from "../hooks/usePagination";
import { useAuth } from "../context/useAuth";
import {
  btnGhostClass,
  btnPrimaryClass,
  inputClass,
  rowActionBtnClass,
  searchInputClass,
  selectClass,
} from "../uiClasses";
import type { Organization, Program } from "../types";

const emptyForm = {
  organizationId: "",
  name: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
};

const ProgramsPage = () => {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [participantCounts, setParticipantCounts] = useState<
    Record<number, number>
  >({});
  const [instFilter, setInstFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOrganizations().then(setOrganizations);
  }, []);

  const refreshPrograms = () => {
    const organizationId =
      role === "super_admin"
        ? instFilter === "all"
          ? undefined
          : Number(instFilter)
        : undefined;

    listPrograms(organizationId).then((list) => {
      setPrograms(list);
      Promise.all(
        list.map((p) =>
          getProgram(p.id).then(
            (full) => [p.id, full.participants.length] as const,
          ),
        ),
      ).then((pairs) => setParticipantCounts(Object.fromEntries(pairs)));
    });
  };

  useEffect(refreshPrograms, [instFilter, role]);

  const orgName = (organizationId: number) =>
    organizations.find((o) => o.id === organizationId)?.name ?? "-";

  const filtered = useMemo(
    () => programs.filter((p) => p.name.includes(search)),
    [programs, search],
  );

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, 6);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (program: Program) => {
    setEditingId(program.id);
    setForm({
      organizationId: String(program.organizationId),
      name: program.name,
      startDate: program.startDate,
      endDate: program.endDate,
      startTime: program.startTime,
      endTime: program.endTime,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        ...(role === "super_admin" && !editingId
          ? { organizationId: Number(form.organizationId) }
          : {}),
      };

      if (editingId) {
        await updateProgram(editingId, payload);
      } else {
        await createProgram(payload);
      }
      setModalOpen(false);
      refreshPrograms();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const handleDelete = async (program: Program) => {
    if (!confirm(`'${program.name}' 사업단을 삭제하시겠습니까?`)) return;
    try {
      await deleteProgram(program.id);
      refreshPrograms();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다.");
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
        <button className={btnPrimaryClass} onClick={openAdd}>
          + 사업단 추가
        </button>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
          <div className="flex items-center gap-2.5">
            {role === "super_admin" && (
              <select
                className={selectClass}
                value={instFilter}
                onChange={(e) => setInstFilter(e.target.value)}
              >
                <option value="all">전체 기관</option>
                {organizations.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            )}
            <input
              className={searchInputClass}
              placeholder="사업단명 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}개 사업단
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1010px] table-fixed border-collapse">
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
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    <button
                      className={rowActionBtnClass}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(program);
                      }}
                    >
                      수정
                    </button>
                    <button
                      className={rowActionBtnClass}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(program);
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

      <SlideModal
        isOpen={modalOpen}
        title={editingId ? "사업단 정보 수정" : "사업단 추가"}
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
        {role === "super_admin" && !editingId && (
          <FormField label="기관 선택">
            <select
              className={inputClass}
              value={form.organizationId}
              onChange={(e) =>
                setForm((f) => ({ ...f, organizationId: e.target.value }))
              }
            >
              <option value="">선택하세요</option>
              {organizations.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="사업단명">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>
        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="시작일">
              <input
                type="date"
                className={inputClass}
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label="종료일">
              <input
                type="date"
                className={inputClass}
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </FormField>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="시작시간">
              <input
                type="time"
                className={inputClass}
                value={form.startTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startTime: e.target.value }))
                }
              />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label="종료시간">
              <input
                type="time"
                className={inputClass}
                value={form.endTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endTime: e.target.value }))
                }
              />
            </FormField>
          </div>
        </div>
        {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
      </SlideModal>
    </div>
  );
};

export default ProgramsPage;
