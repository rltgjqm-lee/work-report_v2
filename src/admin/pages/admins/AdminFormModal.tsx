import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createAdminMutationOptions, updateAdminMutationOptions } from "../../api/admin/admins";
import { organizationOptionsQueryOptions } from "../../api/admin/organizations";
import { useToast } from "../../context/useToast";
import { ROLES, type Admin, type Role } from "../../types/admins";

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

// 엄격한 RFC 검증까지는 필요 없고, "@"와 도메인이 없는 값("test" 같은)만 걸러내면
// 충분하다 — 이 이메일이 비밀번호 찾기 발송 주소로도 그대로 쓰이고, 계정 생성 후엔
// 못 고치므로(의도적) 생성 시점에 걸러야 한다.
const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AdminFormModalProps {
  onClose: () => void;
  editingAdmin: Admin | null;
  currentRole: Role;
  assignableRoles: Role[];
  roleLabel: Record<Role, string>;
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
}: AdminFormModalProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const createAdminMutation = useMutation(createAdminMutationOptions(queryClient));
  const updateAdminMutation = useMutation(updateAdminMutationOptions(queryClient));

  const needsOrganizationOptions = currentRole === ROLES.SUPER_ADMIN && !editingAdmin;
  const { data: organizations = [] } = useQuery({
    ...organizationOptionsQueryOptions,
    enabled: needsOrganizationOptions,
  });
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
    if (!EMAIL_FORMAT_PATTERN.test(form.email)) {
      setError("올바른 이메일 형식을 입력해주세요.");

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

  const roleOptions = assignableRoles.map((assignableRole) => ({
    value: assignableRole,
    label: roleLabel[assignableRole],
  }));

  const organizationOptions = [
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
  ];

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
          onChange={(event) => setForm((form) => ({ ...form, email: event.target.value }))}
        />
        {!editingAdmin && (
          <p className="text-[12px] text-text-subtle mt-1.5">
            비밀번호 변경(찾기) 시 이 이메일로 재설정 링크를 보내드립니다. 생성 후에는 이메일을
            수정할 수 없으니, 실제로 사용 중인 이메일을 입력해주세요.
          </p>
        )}
      </FormField>
      {!editingAdmin && (
        <FormField label="임시 비밀번호 (8자 이상)">
          <Input
            type="password"
            value={form.password}
            onChange={(event) => setForm((form) => ({ ...form, password: event.target.value }))}
          />
        </FormField>
      )}
      {needsOrganizationOptions && (
        <FormField label="소속 기관">
          <FilterSelect
            className="w-full"
            disabled={form.role === ROLES.SUPER_ADMIN}
            value={form.role === ROLES.SUPER_ADMIN ? "" : form.organizationId}
            onChange={(value) => setForm((form) => ({ ...form, organizationId: value }))}
            options={organizationOptions}
          />
        </FormField>
      )}
      <FormField label="역할">
        <FilterSelect
          className="w-full"
          value={form.role}
          onChange={(value) => setForm((form) => ({ ...form, role: value as Role }))}
          options={roleOptions}
        />
      </FormField>
      <FormField label="이름">
        <Input
          value={form.name}
          onChange={(event) => setForm((form) => ({ ...form, name: event.target.value }))}
        />
      </FormField>
      {error && <p className="text-[12.5px] text-admin-error-text">{error}</p>}
    </SlideModal>
  );
};

export default AdminFormModal;
