import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type { Role } from "../../types/admins";
import type { Organization, OrganizationOption } from "../../types/organizations";

import { request } from "../client";

const organizationKeys = {
  all: ["organizations"] as const,
  options: ["organizations", "options"] as const,
  detail: (id: number) => [...organizationKeys.all, id] as const,
  detailPanel: (id: number) => [...organizationKeys.all, id, "detail-panel"] as const,
};
export interface UpdateOrganizationVariables {
  id: number;
  data: Partial<Omit<Organization, "id" | "createdAt">>;
}

const listOrganizations = () => request<Organization[]>("/api/organizations");

export const organizationsQueryOptions = queryOptions({
  queryKey: organizationKeys.all,
  queryFn: listOrganizations,
});

// 이름만 필요한 드롭다운/조회용
const listOrganizationOptions = () => request<OrganizationOption[]>("/api/organizations/dropdown");

export const organizationOptionsQueryOptions = queryOptions({
  queryKey: organizationKeys.options,
  queryFn: listOrganizationOptions,
});

const getOrganization = (id: number) => request<Organization>(`/api/organizations/${id}`);

export const organizationQueryOptions = (id: number) =>
  queryOptions({
    queryKey: organizationKeys.detail(id),
    queryFn: () => getOrganization(id),
  });

export interface OrganizationStaffMember {
  id: number;
  name: string | null;
  email: string;
  role: Role;
}
export interface OrganizationProgramSummary {
  id: number;
  name: string;
  type: string;
  participantCount: number;
  managerName: string;
}
export interface OrganizationSiteSummary {
  id: number;
  site: string;
  count: number;
  manager: string;
}
export interface OrganizationDetail {
  staff: OrganizationStaffMember[];
  programs: OrganizationProgramSummary[];
  sites: OrganizationSiteSummary[];
}

const getOrganizationDetail = (id: number) =>
  request<OrganizationDetail>(`/api/organizations/${id}/detail`);

export const organizationDetailQueryOptions = (id: number) =>
  queryOptions({
    queryKey: organizationKeys.detailPanel(id),
    queryFn: () => getOrganizationDetail(id),
    // 아코디언을 열었다 닫았다 할 때마다 재요청하지 않도록 — 이 데이터를 바꾸는
    // 뮤테이션들이 아직 이 쿼리 키를 무효화하지 않아서 너무 길게 잡지는 않는다.
    staleTime: 60 * 1000,
  });

const createOrganization = (data: Partial<Omit<Organization, "id" | "createdAt">>) =>
  request<Organization>("/api/organizations", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createOrganizationMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });

const updateOrganization = (id: number, data: Partial<Omit<Organization, "id" | "createdAt">>) =>
  request<Organization>(`/api/organizations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const updateOrganizationMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, data }: UpdateOrganizationVariables) => updateOrganization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
