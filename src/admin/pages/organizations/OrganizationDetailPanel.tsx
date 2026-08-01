import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { adminsQueryOptions } from "../../api/admin/admins";
import { programQueryOptions, programsByOrganizationQueryOptions } from "../../api/admin/programs";
import { demandSitesQueryOptions } from "../../api/admin/demandSites";
import { ROLES, type Role } from "../../types";

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

  const { data: admins = [] } = useQuery({ ...adminsQueryOptions, enabled: canViewStaff });
  const staffItems = useMemo(
    () => admins.filter((adminRow) => adminRow.organizationId === organizationId),
    [admins, organizationId],
  );
  // 사업단 담당자로 지정할 수 있는 계정 — ProgramsPage.tsx와 동일한 방식으로 찾는다.
  const managerAdmins = useMemo(
    () => admins.filter((adminRow) => adminRow.role === ROLES.MANAGER && adminRow.isActive),
    [admins],
  );
  const managerAdminName = (programId: number) => {
    const managerAdmin = managerAdmins.find((candidate) =>
      candidate.programIds.includes(programId),
    );
    return managerAdmin?.name ?? managerAdmin?.email ?? "-";
  };

  const { data: programs = [] } = useQuery(programsByOrganizationQueryOptions(organizationId));

  const programQueries = useQueries({
    queries: programs.map((program) => programQueryOptions(program.id)),
  });
  const demandSiteQueries = useQueries({
    queries: programs.map((program) => demandSitesQueryOptions(program.id)),
  });

  const teamItems = useMemo(
    () =>
      programs.map((program, index) => ({
        id: program.id,
        name: program.name,
        type: program.programType ?? "-",
        participantCount: programQueries[index]?.data?.participants.length ?? 0,
        managerName: canViewStaff ? managerAdminName(program.id) : "-",
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- managerAdminName은 admins에서 파생되므로 admins만 있으면 충분
    [programs, programQueries, admins, canViewStaff],
  );

  // 배치 인원은 조 participantCount와 같은 관례로 활성(ACTIVE) 참여자만 센다.
  const siteItems = useMemo(() => {
    const activeParticipants = programQueries.flatMap(
      (programQuery) => programQuery.data?.participants ?? [],
    );

    return programs.flatMap((_program, index) => {
      const sites = demandSiteQueries[index]?.data ?? [];
      return sites.map((site) => ({
        id: site.id,
        site: site.name,
        count: activeParticipants.filter(
          (participant) => participant.demandSiteId === site.id && participant.status === "ACTIVE",
        ).length,
        manager: site.contactAdminName ?? site.contactPerson ?? "-",
      }));
    });
  }, [programs, programQueries, demandSiteQueries]);

  return (
    <div className="flex bg-[#f8f9fb] border border-[#e2e5eb] rounded-[2px] px-6 py-6">
      <div className="flex-1 min-w-0 px-6 border-r border-[#e2e5eb]">
        <div className="text-xs font-bold text-[#6b7280] mb-4">
          소속 직원 · {staffItems.length}명
        </div>
        {!canViewStaff ? (
          <span className="text-[11.5px] text-[#9aa1ab]">권한이 없어 볼 수 없습니다.</span>
        ) : staffItems.length === 0 ? (
          <span className="text-[11.5px] text-[#9aa1ab]">소속 직원이 없습니다.</span>
        ) : (
          <div className="flex flex-col gap-4">
            {staffItems.map((staff) => (
              <div key={staff.id} className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[#1f2937]">{staff.name}</span>
                <span className="text-[11.5px] text-[#8b94a3]">
                  {ROLE_LABEL[staff.role]} · {staff.email}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 px-6 border-r border-[#e2e5eb]">
        <div className="text-xs font-bold text-[#6b7280] mb-4">
          담당 사업단 · {teamItems.length}개
        </div>
        {teamItems.length === 0 ? (
          <span className="text-[11.5px] text-[#9aa1ab]">담당 사업단이 없습니다.</span>
        ) : (
          <div className="flex flex-col gap-4">
            {teamItems.map((team) => (
              <div key={team.id} className="flex flex-col gap-1">
                <a
                  className="text-[13px] font-semibold text-[#1f2937] cursor-pointer hover:text-[#1e3a5f]"
                  onClick={() => navigate(`/admin/programs/${team.id}`)}
                >
                  {team.name}
                </a>
                <span className="text-[11.5px] text-[#8b94a3]">
                  {team.type} · {team.participantCount}명 · 담당자 {team.managerName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 px-6">
        <div className="text-xs font-bold text-[#6b7280] mb-4">
          담당 수요처 · {siteItems.length}개
        </div>
        {siteItems.length === 0 ? (
          <span className="text-[11.5px] text-[#9aa1ab]">담당 수요처가 없습니다.</span>
        ) : (
          <div className="flex flex-col gap-4">
            {siteItems.map((site) => (
              <div key={site.id} className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[#1f2937]">{site.site}</span>
                <span className="text-[11.5px] text-[#8b94a3]">
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
