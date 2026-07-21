import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createProgram,
  getProgram,
  listPrograms,
  updateProgram,
} from "../api/admin/programs";
import { listOrganizations } from "../api/admin/organizations";
import Pagination from "../components/Pagination";
import SlideModal from "../components/SlideModal";
import FormField from "../components/FormField";
import SearchInput from "../components/SearchInput";
import FilterSelect from "../components/FilterSelect";
import { usePagination } from "../hooks/usePagination";
import { useAuth } from "../context/useAuth";
import {
  btnGhostClass,
  btnPrimaryClass,
  inputClass,
  rowActionBtnClass,
} from "../uiClasses";
import { ROLES, type Organization, type Program } from "../types";

const emptyForm = {
  organizationId: "",
  name: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  programType: "",
  hourlyWage: "10320",
  educationAmount: "0",
  educationType: "add" as "add" | "deduct",
  dementiaAmount: "0",
  dementiaType: "deduct" as "add" | "deduct",
};

/**
 * 관리자 페이지 > 사업단 관리 페이지입니다.
 *
 */
const ProgramsPage = () => {
  const { admin } = useAuth();
  const role = admin?.role;

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
      role === ROLES.SUPER_ADMIN
        ? instFilter === "all"
          ? undefined
          : Number(instFilter)
        : undefined;

    listPrograms(organizationId).then((list) => {
      setPrograms(list);
      Promise.all(
        list.map((program) =>
          getProgram(program.id).then(
            (full) => [program.id, full.participants.length] as const,
          ),
        ),
      ).then((pairs) => setParticipantCounts(Object.fromEntries(pairs)));
    });
  };

  useEffect(refreshPrograms, [instFilter, role]);

  const orgName = (organizationId: number) =>
    organizations.find((organization) => organization.id === organizationId)
      ?.name ?? "-";

  const filtered = useMemo(
    () => programs.filter((program) => program.name.includes(search)),
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
      programType: program.programType ?? "",
      hourlyWage: String(program.hourlyWage),
      educationAmount: String(program.educationAmount),
      educationType: program.educationType,
      dementiaAmount: String(program.dementiaAmount),
      dementiaType: program.dementiaType,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      setError("종료일은 시작일 이후여야 합니다.");

      return;
    }
    if (form.endTime && form.startTime && form.endTime < form.startTime) {
      setError("종료 시간은 시작 시간 이후여야 합니다.");

      return;
    }

    try {
      const payload = {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        programType: form.programType || undefined,
        hourlyWage: Number(form.hourlyWage),
        educationAmount: Number(form.educationAmount),
        educationType: form.educationType,
        dementiaAmount: Number(form.dementiaAmount),
        dementiaType: form.dementiaType,
        ...(role === ROLES.SUPER_ADMIN && !editingId
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
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const handleToggleActive = async (program: Program) => {
    const actionLabel = program.isActive ? "비활성화" : "활성화";
    if (
      !confirm(
        `'${program.name}' 사업단을 ${actionLabel}하시겠습니까?${
          program.isActive
            ? " 소속된 활성 참여자는 모두 참여종료 처리됩니다."
            : ""
        }`,
      )
    )
      return;

    try {
      await updateProgram(program.id, { isActive: !program.isActive });
      refreshPrograms();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
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
            {role === ROLES.SUPER_ADMIN && (
              <FilterSelect
                value={instFilter}
                onChange={setInstFilter}
                options={[
                  { value: "all", label: "전체 기관" },
                  ...organizations.map((organization) => ({
                    value: String(organization.id),
                    label: organization.name,
                  })),
                ]}
              />
            )}

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="사업단명 검색"
            />
          </div>
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}개 사업단
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse">
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
                <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  상태
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
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {program.isActive ? "활성" : "비활성"}
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
                        handleToggleActive(program);
                      }}
                    >
                      {program.isActive ? "비활성화" : "활성화"}
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
        {/* 기관 선택 */}
        {role === ROLES.SUPER_ADMIN && !editingId && (
          <FormField label="기관 선택">
            <select
              className={inputClass}
              value={form.organizationId}
              onChange={(event) =>
                setForm((f) => ({ ...f, organizationId: event.target.value }))
              }
            >
              <option value="">선택하세요</option>
              {organizations
                .filter((organization) => organization.isActive)
                .map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
            </select>
          </FormField>
        )}

        {/* 사업단 명 */}
        <FormField label="사업단 명">
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) =>
              setForm((f) => ({ ...f, name: event.target.value }))
            }
          />
        </FormField>

        <div className="flex gap-3">
          {/* 시작일 */}
          <div className="flex-1">
            <FormField label="시작일">
              <input
                type="date"
                className={inputClass}
                value={form.startDate}
                onChange={(event) =>
                  setForm((f) => ({ ...f, startDate: event.target.value }))
                }
              />
            </FormField>
          </div>

          {/* 종료일 */}
          <div className="flex-1">
            <FormField label="종료일">
              <input
                type="date"
                className={inputClass}
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(event) =>
                  setForm((f) => ({ ...f, endDate: event.target.value }))
                }
              />
            </FormField>
          </div>
        </div>

        <div className="flex gap-3">
          {/* 시작 시간 */}
          <div className="flex-1">
            <FormField label="시작 시간">
              <input
                type="time"
                className={inputClass}
                value={form.startTime}
                onChange={(event) =>
                  setForm((f) => ({ ...f, startTime: event.target.value }))
                }
              />
            </FormField>
          </div>

          {/* 종료 시간  */}
          <div className="flex-1">
            <FormField label="종료 시간">
              <input
                type="time"
                className={inputClass}
                value={form.endTime}
                min={form.startTime || undefined}
                onChange={(event) =>
                  setForm((f) => ({ ...f, endTime: event.target.value }))
                }
              />
            </FormField>
          </div>
        </div>

        {/* 사업 유형 */}
        <FormField label="사업 유형">
          <select
            className={inputClass}
            value={form.programType}
            onChange={(event) =>
              setForm((f) => ({ ...f, programType: event.target.value }))
            }
          >
            <option value="">선택하세요</option>
            <option value="공익 활동">공익 활동</option>
            <option value="역량 활동">역량 활동</option>
          </select>
        </FormField>

        {/* 시급 */}
        <FormField label="시급(원)">
          <input
            type="number"
            className={inputClass}
            value={form.hourlyWage}
            onChange={(event) =>
              setForm((f) => ({ ...f, hourlyWage: event.target.value }))
            }
          />
        </FormField>

        <div className="flex gap-3">
          {/* 교육비 */}
          <div className="flex-1">
            <FormField label="교육비(원)">
              <input
                type="number"
                className={inputClass}
                value={form.educationAmount}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    educationAmount: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          {/* 교육비 처리 - 가산/차감 */}
          <div className="flex-1">
            <FormField label="교육비 처리">
              <select
                className={inputClass}
                value={form.educationType}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    educationType: event.target.value as "add" | "deduct",
                  }))
                }
              >
                <option value="add">가산</option>
                <option value="deduct">차감</option>
              </select>
            </FormField>
          </div>
        </div>

        <div className="flex gap-3">
          {/* 치매 검진비 */}
          <div className="flex-1">
            <FormField label="치매 검진비(원)">
              <input
                type="number"
                className={inputClass}
                value={form.dementiaAmount}
                onChange={(event) =>
                  setForm((f) => ({ ...f, dementiaAmount: event.target.value }))
                }
              />
            </FormField>
          </div>

          {/* 치매 검진비 처리 - 가산/차감 */}
          <div className="flex-1">
            <FormField label="치매검진비 처리">
              <select
                className={inputClass}
                value={form.dementiaType}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    dementiaType: event.target.value as "add" | "deduct",
                  }))
                }
              >
                <option value="add">가산</option>
                <option value="deduct">차감</option>
              </select>
            </FormField>
          </div>
        </div>

        {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
      </SlideModal>
    </div>
  );
};

export default ProgramsPage;
