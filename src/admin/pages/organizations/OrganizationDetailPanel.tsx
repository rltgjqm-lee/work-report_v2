import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { organizationDetailQueryOptions } from "../../api/admin/organizations";
import { ROLES, type Role } from "../../types/admins";

const ROLE_LABEL: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "서비스 총괄 관리자",
  [ROLES.ORGANIZATION_ADMIN]: "기관 관리자",
  [ROLES.SUB_ADMIN]: "부관리자",
  [ROLES.MANAGER]: "담당자",
};

interface OrganizationDetailPanelProps {
  organizationId: number;
  canViewStaff: boolean;
}

/**
 * 기관 관리 페이지에서 기관 하나의 소속 직원 · 담당 사업단 · 담당 수요처를 보여주는 패널입니다.
 * SUPER_ADMIN은 토글로, 그 외 역할은 항상 노출되는 영역으로 이 컴포넌트를 그대로 재사용합니다.
 */
const OrganizationDetailPanel = ({
  organizationId,
  canViewStaff,
}: OrganizationDetailPanelProps) => {
  const navigate = useNavigate();

  const { data } = useQuery(organizationDetailQueryOptions(organizationId));
  const staffItems = data?.staff ?? [];
  const programItems = data?.programs ?? [];
  const siteItems = data?.sites ?? [];

  return (
    <div className="flex bg-admin-surface-header border border-admin-border-subtle rounded-[2px] px-6 py-6">
      <div className="flex-1 min-w-0 px-6 border-r border-admin-border-subtle">
        <div className="text-xs font-bold text-text-subtle mb-4">
          소속 직원 · {staffItems.length}명
        </div>
        {!canViewStaff ? (
          <span className="text-[11.5px] text-admin-text-placeholder">
            권한이 없어 볼 수 없습니다.
          </span>
        ) : staffItems.length === 0 ? (
          <span className="text-[11.5px] text-admin-text-placeholder">소속 직원이 없습니다.</span>
        ) : (
          <div className="flex flex-col gap-4">
            {staffItems.map((staff) => (
              <div key={staff.id} className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-text-strong">{staff.name}</span>
                <span className="text-[11.5px] text-admin-text-faint">
                  {ROLE_LABEL[staff.role]} · {staff.email}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 px-6 border-r border-admin-border-subtle">
        <div className="text-xs font-bold text-text-subtle mb-4">
          담당 사업단 · {programItems.length}개
        </div>
        {programItems.length === 0 ? (
          <span className="text-[11.5px] text-admin-text-placeholder">담당 사업단이 없습니다.</span>
        ) : (
          <div className="flex flex-col gap-4">
            {programItems.map((program) => (
              <div key={program.id} className="flex flex-col gap-1">
                <a
                  className="text-[13px] font-semibold text-text-strong cursor-pointer hover:text-admin-brand"
                  onClick={() => navigate(`/admin/programs/${program.id}`)}
                >
                  {program.name}
                </a>
                <span className="text-[11.5px] text-admin-text-faint">
                  {program.type} · {program.participantCount}명 · 담당자 {program.managerName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 px-6">
        <div className="text-xs font-bold text-text-subtle mb-4">
          담당 수요처 · {siteItems.length}개
        </div>
        {siteItems.length === 0 ? (
          <span className="text-[11.5px] text-admin-text-placeholder">담당 수요처가 없습니다.</span>
        ) : (
          <div className="flex flex-col gap-4">
            {siteItems.map((site) => (
              <div key={site.id} className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-text-strong">{site.site}</span>
                <span className="text-[11.5px] text-admin-text-faint">
                  배치 {site.count}명 · 담당자 {site.manager}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationDetailPanel;
