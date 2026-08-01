import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  organizationsQueryOptions,
  updateOrganizationMutationOptions,
} from "../../api/admin/organizations";
import Pagination from "../../components/Pagination";
import OrganizationFormModal from "./OrganizationFormModal";
import OrganizationDetailPanel from "./OrganizationDetailPanel";
import SearchInput from "../../components/SearchInput";
import { usePagination } from "../../hooks/usePagination";
import { useAuth } from "../../context/useAuth";
import { btnPrimaryClass, rowActionBtnClass } from "../../uiClasses";
import { ROLES, type Organization } from "../../types";

/**
 * 관리자 페이지 > 기관 관리 페이지입니다.
 *
 */
const OrganizationsPage = () => {
  const { admin } = useAuth();
  const role = admin?.role;

  const queryClient = useQueryClient();
  const { data: organizations = [] } = useQuery(organizationsQueryOptions);

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [expandedOrgId, setExpandedOrgId] = useState<number | null>(null);

  // 소속 직원 목록(/api/admins)은 SUPER_ADMIN/ORGANIZATION_ADMIN만 조회 권한이 있다.
  const canViewStaff = role === ROLES.SUPER_ADMIN || role === ROLES.ORGANIZATION_ADMIN;

  const filtered = useMemo(
    () =>
      organizations.filter(
        (organization) =>
          organization.name.includes(search) || (organization.rep ?? "").includes(search),
      ),
    [organizations, search],
  );

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, 5);

  const handleAddButtonClick = () => {
    setEditingOrganization(null);
    setModalOpen(true);
  };

  const handleEditButtonClick = (organization: Organization) => {
    setEditingOrganization(organization);
    setModalOpen(true);
  };

  const updateOrganizationMutation = useMutation(updateOrganizationMutationOptions(queryClient));

  const handleToggleActiveButtonClick = (organization: Organization) => {
    const actionLabel = organization.isActive ? "비활성화" : "활성화";

    if (!confirm(`'${organization.name}' 기관을 ${actionLabel}하시겠습니까?`)) return;

    updateOrganizationMutation.mutate(
      { id: organization.id, data: { isActive: !organization.isActive } },
      {
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
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
        {role === ROLES.SUPER_ADMIN && (
          <button className={btnPrimaryClass} onClick={handleAddButtonClick}>
            + 기관 추가
          </button>
        )}
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        {role === ROLES.SUPER_ADMIN && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="기관명 또는 대표자 검색"
            />
            <span className="text-xs text-[#6b7280] font-medium whitespace-nowrap">
              총 {filtered.length}개 기관
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1190px] table-fixed border-collapse">
            <thead>
              <tr>
                {role === ROLES.SUPER_ADMIN && (
                  <th className="w-[32px] bg-[#f7f8fa] px-2 py-[11px] border-b border-[#e2e5eb]" />
                )}
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
                <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  상태
                </th>
                <th className="w-[130px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((organization) => (
                <Fragment key={organization.id}>
                  <tr className="hover:bg-[#f8fafc]">
                    {role === ROLES.SUPER_ADMIN && (
                      <td className="px-2 py-[13px] text-[13px] border-b border-[#eef0f3]">
                        <button
                          className="w-6 h-6 border-none bg-transparent text-[#6b7280] text-xs cursor-pointer p-0"
                          onClick={() =>
                            setExpandedOrgId((current) =>
                              current === organization.id ? null : organization.id,
                            )
                          }
                        >
                          {expandedOrgId === organization.id ? "▾" : "▸"}
                        </button>
                      </td>
                    )}
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                      {organization.name}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                      {organization.rep}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                      {organization.phone}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                      {organization.fax}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                      {organization.bizNo}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                      {organization.address}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                      {organization.isActive ? "활성" : "비활성"}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                      {(role === ROLES.SUPER_ADMIN || role === ROLES.ORGANIZATION_ADMIN) && (
                        <button
                          className={rowActionBtnClass}
                          onClick={() => handleEditButtonClick(organization)}
                        >
                          수정
                        </button>
                      )}
                      {role === ROLES.SUPER_ADMIN && (
                        <button
                          className={rowActionBtnClass}
                          onClick={() => handleToggleActiveButtonClick(organization)}
                        >
                          {organization.isActive ? "비활성화" : "활성화"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {role === ROLES.SUPER_ADMIN && expandedOrgId === organization.id && (
                    <tr>
                      <td colSpan={9} className="p-3 bg-white border-b border-[#e2e5eb]">
                        <OrganizationDetailPanel
                          organizationId={organization.id}
                          canViewStaff={canViewStaff}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {role === ROLES.SUPER_ADMIN && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        )}
      </div>

      {role !== ROLES.SUPER_ADMIN &&
        pageItems.map((organization) => (
          <div key={organization.id} className="mt-5">
            <div className="text-sm font-bold mb-2.5">{organization.name} 상세</div>
            <div className="bg-white border border-[#e2e5eb] rounded-[2px] p-3">
              <OrganizationDetailPanel
                organizationId={organization.id}
                canViewStaff={canViewStaff}
              />
            </div>
          </div>
        ))}

      {modalOpen && (
        <OrganizationFormModal
          onClose={() => setModalOpen(false)}
          editingOrganization={editingOrganization}
        />
      )}
    </div>
  );
};

export default OrganizationsPage;
