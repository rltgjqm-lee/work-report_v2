import { useEffect, useMemo, useState } from "react";

import {
  createOrganization,
  deleteOrganization,
  listOrganizations,
  updateOrganization,
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
} from "../uiClasses";
import type { Organization } from "../types";

const emptyForm = {
  name: "",
  address: "",
  rep: "",
  phone: "",
  fax: "",
  bizNo: "",
};

const OrganizationsPage = () => {
  const { role } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    listOrganizations().then(setOrganizations);
  };

  useEffect(refresh, []);

  const filtered = useMemo(
    () =>
      organizations.filter(
        (o) => o.name.includes(search) || (o.rep ?? "").includes(search),
      ),
    [organizations, search],
  );

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, 5);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (org: Organization) => {
    setEditingId(org.id);
    setForm({
      name: org.name,
      address: org.address ?? "",
      rep: org.rep ?? "",
      phone: org.phone ?? "",
      fax: org.fax ?? "",
      bizNo: org.bizNo ?? "",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateOrganization(editingId, form);
      } else {
        await createOrganization(form);
      }
      setModalOpen(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const handleDelete = async (org: Organization) => {
    if (!confirm(`'${org.name}' 기관을 삭제하시겠습니까?`)) return;
    try {
      await deleteOrganization(org.id);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold m-0">기관 관리</h1>
          <p className="text-[13px] text-[#6b7280] mt-1.5">
            사업단이 소속되는 기관 정보를 등록하고 관리합니다.
          </p>
        </div>
        {role === "super_admin" && (
          <button className={btnPrimaryClass} onClick={openAdd}>
            + 기관 추가
          </button>
        )}
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
          <input
            className={searchInputClass}
            placeholder="기관명 또는 대표자 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}개 기관
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[180px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  기관명
                </th>
                <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  대표자
                </th>
                <th className="w-[150px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  전화번호
                </th>
                <th className="w-[150px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  팩스번호
                </th>
                <th className="w-[150px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  사업자등록번호
                </th>
                <th className="w-[240px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  주소
                </th>
                <th className="w-[130px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((org) => (
                <tr key={org.id} className="hover:bg-[#f8fafc]">
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {org.name}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {org.rep}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {org.phone}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {org.fax}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {org.bizNo}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {org.address}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    <button
                      className={rowActionBtnClass}
                      onClick={() => openEdit(org)}
                    >
                      수정
                    </button>
                    {role === "super_admin" && (
                      <button
                        className={rowActionBtnClass}
                        onClick={() => handleDelete(org)}
                      >
                        삭제
                      </button>
                    )}
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
        title={editingId ? "기관 정보 수정" : "기관 추가"}
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
        <FormField label="기관명">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>
        <FormField label="기관주소">
          <input
            className={inputClass}
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
          />
        </FormField>
        <FormField label="대표자">
          <input
            className={inputClass}
            value={form.rep}
            onChange={(e) => setForm((f) => ({ ...f, rep: e.target.value }))}
          />
        </FormField>
        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="전화번호">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label="팩스번호">
              <input
                className={inputClass}
                value={form.fax}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fax: e.target.value }))
                }
              />
            </FormField>
          </div>
        </div>
        <FormField label="사업자 등록번호">
          <input
            className={inputClass}
            value={form.bizNo}
            onChange={(e) => setForm((f) => ({ ...f, bizNo: e.target.value }))}
          />
        </FormField>
        {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
      </SlideModal>
    </div>
  );
};

export default OrganizationsPage;
