import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createAdminMutationOptions, updateAdminMutationOptions } from "../../api/admin/admins";
import { useToast } from "../../context/useToast";
import { ROLES, type Admin, type Role } from "../../types/admins";
import type { Organization } from "../../types/organizations";

import Button from "../../components/Button";
import FilterSelect from "../../components/FilterSelect";
import FormField from "../../components/FormField";
import Input from "../../components/Input";
import SlideModal from "../../components/modal/SlideModal";

const emptyForm = {
  email: "",
  name: "",
  role: ROLES.MANAGER as Role,
  organizationId: "",
  password: "",
};

interface AdminFormModalProps {
  onClose: () => void;
  editingAdmin: Admin | null;
  currentRole: Role;
  assignableRoles: Role[];
  roleLabel: Record<Role, string>;
  organizations: Organization[];
}

/**
 * 관리자 페이지 > 관리자 계정 페이지에서 계정을 발급/수정하는 모달입니다.
 *
 */
// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 아래 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const AdminFormModal = ({
  onClose,
  editingAdmin,
  currentRole,
  assignableRoles,
  roleLabel,
  organizations,
}: AdminFormModalProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const createAdminMutation = useMutation(createAdminMutationOptions(queryClient));
  const updateAdminMutation = useMutation(updateAdminMutationOptions(queryClient));
  // 총괄 관리자 계정은 소속 기관이 없어서, 기본 역할이 총괄이면 모달을 열자마자
  // 기관 선택이 비활성으로 뜬다. 총괄 계정을 새로 만드는 일은 드물기 때문에
  // 기본값은 기관을 고를 수 있는 역할로 잡는다.
  const defaultRole =
    assignableRoles.find((assignableRole) => assignableRole !== ROLES.SUPER_ADMIN) ??
    assignableRoles[0] ??
    ROLES.MANAGER;

  const [form, setForm] = useState(
    editingAdmin
      ? {
          email: editingAdmin.email,
          name: editingAdmin.name ?? "",
          role: editingAdmin.role,
          organizationId: editingAdmin.organizationId ? String(editingAdmin.organizationId) : "",
          password: "",
        }
      : { ...emptyForm, role: defaultRole },
  );
  const [error, setError] = useState<string | null>(null);

  const handleSaveButtonClick = () => {
    if (!form.name) {
      setError("이름을 입력해주세요.");

      return;
    }

    // UI 한정: 저장 성공하면 이 모달을 닫고, 실패하면 폼에 에러 메시지를 보여준다.
    const saveCallbacks = {
      onSuccess: () => {
        showToast(editingAdmin ? "계정 정보를 수정했습니다." : "계정을 발급했습니다.");
        onClose();
      },
      onError: (error: unknown) =>
        setError(error instanceof Error ? error.message : "저장에 실패했습니다."),
    };

    if (editingAdmin) {
      updateAdminMutation.mutate(
        { id: editingAdmin.id, data: { name: form.name, role: form.role } },
        saveCallbacks,
      );

      return;
    }

    if (!form.email) {
      setError("이메일을 입력해주세요.");

      return;
    }
    if (form.password.length < 8) {
      setError("임시 비밀번호는 8자 이상이어야 합니다.");

      return;
    }
    // 서비스 총괄 관리자는 특정 기관에 속하지 않는다(목록에서도 "전체"로 표시).
    // 그 외 역할은 소속 기관이 반드시 있어야 하고, 서버도 400으로 막는다.
    const needsOrganization = currentRole === ROLES.SUPER_ADMIN && form.role !== ROLES.SUPER_ADMIN;
    if (needsOrganization && !form.organizationId) {
      setError("소속 기관을 선택해주세요.");

      return;
    }

    createAdminMutation.mutate(
      {
        email: form.email,
        name: form.name,
        role: form.role,
        organizationId: needsOrganization ? Number(form.organizationId) : undefined,
        password: form.password,
      },
      saveCallbacks,
    );
  };

  return (
    <SlideModal
      isOpen
      title={editingAdmin ? "관리자 계정 수정" : "관리자 계정 발급"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSaveButtonClick}>저장</Button>
        </>
      }
    >
      <FormField label="이메일 (로그인 계정)">
        <Input
          value={form.email}
          disabled={!!editingAdmin}
          onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
        />
      </FormField>
      {!editingAdmin && (
        <FormField label="임시 비밀번호 (8자 이상)">
          <Input
            type="password"
            value={form.password}
            onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
          />
        </FormField>
      )}
      {currentRole === ROLES.SUPER_ADMIN && !editingAdmin && (
        <FormField label="소속 기관">
          <FilterSelect
            className="w-full"
            disabled={form.role === ROLES.SUPER_ADMIN}
            value={form.role === ROLES.SUPER_ADMIN ? "" : form.organizationId}
            onChange={(value) => setForm((f) => ({ ...f, organizationId: value }))}
            options={[
              {
                value: "",
                label: form.role === ROLES.SUPER_ADMIN ? "전체 (소속 기관 없음)" : "선택하세요",
              },
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
      <FormField label="이름">
        <Input
          value={form.name}
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
        />
      </FormField>
      {error && <p className="text-[12.5px] text-admin-error-text">{error}</p>}
    </SlideModal>
  );
};

export default AdminFormModal;
