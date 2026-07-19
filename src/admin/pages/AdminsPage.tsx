import { useEffect, useMemo, useState } from "react";

import { createAdmin, listAdmins, updateAdmin } from "../api/admin/admins";
import { listOrganizations } from "../api/admin/organizations";
import SlideModal from "../components/SlideModal";
import FormField from "../components/FormField";
import { useAuth } from "../context/useAuth";
import {
  btnGhostClass,
  btnPrimaryClass,
  inputClass,
  rowActionBtnClass,
  searchInputClass,
  selectClass,
} from "../uiClasses";
import { ROLES, type Admin, type Organization, type Role } from "../types";

const ROLE_LABEL: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "서비스 총괄 관리자",
  [ROLES.ORGANIZATION_ADMIN]: "기관 관리자",
  [ROLES.SUB_ADMIN]: "부관리자",
  [ROLES.MANAGER]: "담당자",
};

const ASSIGNABLE_ROLES: Record<Role, Role[]> = {
  [ROLES.SUPER_ADMIN]: [
    ROLES.SUPER_ADMIN,
    ROLES.ORGANIZATION_ADMIN,
    ROLES.SUB_ADMIN,
    ROLES.MANAGER,
  ],
  [ROLES.ORGANIZATION_ADMIN]: [ROLES.SUB_ADMIN, ROLES.MANAGER],
  [ROLES.SUB_ADMIN]: [],
  [ROLES.MANAGER]: [],
};

const emptyForm = {
  email: "",
  name: "",
  role: ROLES.MANAGER as Role,
  organizationId: "",
};

const AdminsPage = () => {
  const { admin } = useAuth();
  const role = admin?.role;
  const assignableRoles = role ? ASSIGNABLE_ROLES[role] : [];

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    listAdmins().then(setAdmins);
  };

  useEffect(refresh, []);
  useEffect(() => {
    if (role === ROLES.SUPER_ADMIN) listOrganizations().then(setOrganizations);
  }, [role]);

  const orgName = (organizationId: number | null) =>
    organizations.find((organization) => organization.id === organizationId)
      ?.name ?? "-";

  const filtered = useMemo(
    () =>
      admins.filter(
        (adminRow) =>
          (adminRow.name ?? "").includes(search) ||
          adminRow.email.includes(search),
      ),
    [admins, search],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, role: assignableRoles[0] ?? ROLES.MANAGER });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (adminRow: Admin) => {
    setEditingId(adminRow.id);
    setForm({
      email: adminRow.email,
      name: adminRow.name ?? "",
      role: adminRow.role,
      organizationId: adminRow.organizationId
        ? String(adminRow.organizationId)
        : "",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      setError("이름을 입력해주세요.");
      return;
    }
    try {
      if (editingId) {
        await updateAdmin(editingId, { name: form.name, role: form.role });
      } else {
        if (!form.email) {
          setError("이메일을 입력해주세요.");
          return;
        }
        await createAdmin({
          email: form.email,
          name: form.name,
          role: form.role,
          organizationId:
            role === ROLES.SUPER_ADMIN && form.organizationId
              ? Number(form.organizationId)
              : undefined,
        });
      }
      setModalOpen(false);
      refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const handleToggleActive = async (adminRow: Admin) => {
    const actionLabel = adminRow.isActive ? "비활성화" : "활성화";
    if (
      !confirm(
        `'${adminRow.name ?? adminRow.email}' 계정을 ${actionLabel}하시겠습니까?`,
      )
    )
      return;
    try {
      await updateAdmin(adminRow.id, { isActive: !adminRow.isActive });
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  if (!role || assignableRoles.length === 0) {
    return (
      <div className="text-[13px] text-[#6b7280]">
        관리자 계정을 관리할 권한이 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold m-0">관리자 계정</h1>
          <p className="text-[13px] text-[#6b7280] mt-1.5">
            기관과 계약 체결 후 발급하는 관리자 계정을 등록하고 관리합니다.
          </p>
        </div>
        <button className={btnPrimaryClass} onClick={openAdd}>
          + 관리자 계정 발급
        </button>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
          <input
            className={searchInputClass}
            placeholder="이름 또는 이메일 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[140px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  이름
                </th>
                <th className="w-[220px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  이메일
                </th>
                <th className="w-[140px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  역할
                </th>
                <th className="w-[160px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  소속 기관
                </th>
                <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  상태
                </th>
                <th className="w-[130px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((adminRow) => (
                <tr key={adminRow.id} className="hover:bg-[#f8fafc]">
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {adminRow.name ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {adminRow.email}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {ROLE_LABEL[adminRow.role]}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {adminRow.role === ROLES.SUPER_ADMIN
                      ? "전체"
                      : orgName(adminRow.organizationId)}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {adminRow.isActive ? "활성" : "비활성"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    <button
                      className={rowActionBtnClass}
                      onClick={() => openEdit(adminRow)}
                    >
                      수정
                    </button>
                    <button
                      className={rowActionBtnClass}
                      onClick={() => handleToggleActive(adminRow)}
                    >
                      {adminRow.isActive ? "비활성화" : "활성화"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SlideModal
        isOpen={modalOpen}
        title={editingId ? "관리자 계정 수정" : "관리자 계정 발급"}
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
        <FormField label="이메일 (CF Access 로그인 계정)">
          <input
            className={inputClass}
            value={form.email}
            disabled={!!editingId}
            onChange={(event) =>
              setForm((f) => ({ ...f, email: event.target.value }))
            }
          />
        </FormField>
        <FormField label="이름">
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) =>
              setForm((f) => ({ ...f, name: event.target.value }))
            }
          />
        </FormField>
        <FormField label="역할">
          <select
            className={selectClass + " w-full"}
            value={form.role}
            onChange={(event) =>
              setForm((f) => ({ ...f, role: event.target.value as Role }))
            }
          >
            {assignableRoles.map((assignableRole) => (
              <option key={assignableRole} value={assignableRole}>
                {ROLE_LABEL[assignableRole]}
              </option>
            ))}
          </select>
        </FormField>
        {role === ROLES.SUPER_ADMIN &&
          form.role !== ROLES.SUPER_ADMIN &&
          !editingId && (
            <FormField label="소속 기관">
              <select
                className={selectClass + " w-full"}
                value={form.organizationId}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    organizationId: event.target.value,
                  }))
                }
              >
                <option value="">선택하세요</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
      </SlideModal>
    </div>
  );
};

export default AdminsPage;
