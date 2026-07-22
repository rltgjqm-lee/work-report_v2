import { useState } from "react";

import { createAdmin, updateAdmin } from "../../api/admin/admins";
import SlideModal from "../../components/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import { ROLES, type Admin, type Organization, type Role } from "../../types";

const emptyForm = {
  email: "",
  name: "",
  role: ROLES.MANAGER as Role,
  organizationId: "",
};

interface AdminFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  editingAdmin: Admin | null;
  currentRole: Role;
  assignableRoles: Role[];
  roleLabel: Record<Role, string>;
  organizations: Organization[];
}

// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 아래 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const AdminFormModal = ({
  onClose,
  onSaved,
  editingAdmin,
  currentRole,
  assignableRoles,
  roleLabel,
  organizations,
}: AdminFormModalProps) => {
  const [form, setForm] = useState(
    editingAdmin
      ? {
          email: editingAdmin.email,
          name: editingAdmin.name ?? "",
          role: editingAdmin.role,
          organizationId: editingAdmin.organizationId
            ? String(editingAdmin.organizationId)
            : "",
        }
      : { ...emptyForm, role: assignableRoles[0] ?? ROLES.MANAGER },
  );
  const [error, setError] = useState<string | null>(null);

  const handleSaveButtonClick = async () => {
    if (!form.name) {
      setError("이름을 입력해주세요.");

      return;
    }
    try {
      if (editingAdmin) {
        await updateAdmin(editingAdmin.id, {
          name: form.name,
          role: form.role,
        });
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
            currentRole === ROLES.SUPER_ADMIN && form.organizationId
              ? Number(form.organizationId)
              : undefined,
        });
      }
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title={editingAdmin ? "관리자 계정 수정" : "관리자 계정 발급"}
      onClose={onClose}
      footer={
        <>
          <button className={btnGhostClass} onClick={onClose}>
            취소
          </button>
          <button className={btnPrimaryClass} onClick={handleSaveButtonClick}>
            저장
          </button>
        </>
      }
    >
      <FormField label="이메일 (CF Access 로그인 계정)">
        <input
          className={inputClass}
          value={form.email}
          disabled={!!editingAdmin}
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
        <FilterSelect
          className="w-full"
          value={form.role}
          onChange={(value) => setForm((f) => ({ ...f, role: value as Role }))}
          options={assignableRoles.map((assignableRole) => ({
            value: assignableRole,
            label: roleLabel[assignableRole],
          }))}
        />
      </FormField>
      {currentRole === ROLES.SUPER_ADMIN &&
        form.role !== ROLES.SUPER_ADMIN &&
        !editingAdmin && (
          <FormField label="소속 기관">
            <FilterSelect
              className="w-full"
              value={form.organizationId}
              onChange={(value) =>
                setForm((f) => ({ ...f, organizationId: value }))
              }
              options={[
                { value: "", label: "선택하세요" },
                ...organizations
                  .filter((organization) => organization.isActive)
                  .map((organization) => ({
                    value: String(organization.id),
                    label: organization.name,
                  })),
              ]}
            />
          </FormField>
        )}
      {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
    </SlideModal>
  );
};

export default AdminFormModal;
