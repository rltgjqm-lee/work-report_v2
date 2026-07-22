import { useEffect, useMemo, useState } from "react";

import { listAdmins, updateAdmin } from "../../api/admin/admins";
import { listOrganizations } from "../../api/admin/organizations";
import AdminFormModal from "./AdminFormModal";
import ResetPasswordModal from "./ResetPasswordModal";
import SearchInput from "../../components/SearchInput";
import { useAuth } from "../../context/useAuth";
import { btnPrimaryClass, rowActionBtnClass } from "../../uiClasses";
import { ROLES, type Admin, type Organization, type Role } from "../../types";

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

/**
 * 관리자 페이지 > 관리자 계정 페이지입니다.
 *
 */
const AdminsPage = () => {
  const { admin } = useAuth();
  const role = admin?.role;
  const assignableRoles = role ? ASSIGNABLE_ROLES[role] : [];

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

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

  const handleAddButtonClick = () => {
    setEditingAdmin(null);
    setModalOpen(true);
  };

  const handleEditButtonClick = (adminRow: Admin) => {
    setEditingAdmin(adminRow);
    setModalOpen(true);
  };

  const handleAdminSaved = () => {
    setModalOpen(false);
    refresh();
  };

  const handleToggleActiveButtonClick = async (adminRow: Admin) => {
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

  const handleResetPasswordButtonClick = (adminRow: Admin) => {
    setResetPasswordTarget({
      id: adminRow.id,
      name: adminRow.name ?? adminRow.email,
    });
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
        <button className={btnPrimaryClass} onClick={handleAddButtonClick}>
          + 관리자 계정 발급
        </button>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="이름 또는 이메일 검색"
          />
          <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
            총 {filtered.length}명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse">
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
                <th className="w-[210px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
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
                      onClick={() => handleEditButtonClick(adminRow)}
                    >
                      수정
                    </button>
                    <button
                      className={rowActionBtnClass}
                      onClick={() => handleToggleActiveButtonClick(adminRow)}
                    >
                      {adminRow.isActive ? "비활성화" : "활성화"}
                    </button>
                    <button
                      className={rowActionBtnClass}
                      onClick={() => handleResetPasswordButtonClick(adminRow)}
                    >
                      비밀번호 재설정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <AdminFormModal
          onClose={() => setModalOpen(false)}
          onSaved={handleAdminSaved}
          editingAdmin={editingAdmin}
          currentRole={role}
          assignableRoles={assignableRoles}
          roleLabel={ROLE_LABEL}
          organizations={organizations}
        />
      )}

      {resetPasswordTarget && (
        <ResetPasswordModal
          onClose={() => setResetPasswordTarget(null)}
          target={resetPasswordTarget}
        />
      )}
    </div>
  );
};

export default AdminsPage;
