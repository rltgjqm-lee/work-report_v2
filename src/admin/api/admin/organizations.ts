import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type { Organization, OrganizationOption } from "../../types/organizations";

import { request } from "../client";

const organizationKeys = {
  all: ["organizations"] as const,
  options: ["organizations", "options"] as const,
  detail: (id: number) => [...organizationKeys.all, id] as const,
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

// 이름만 필요한 드롭다운/조회용 — 서버가 그 화면이 쓰는 컬럼(id/name/isActive)만
// 골라 내려주는 전용 라우트를 쓴다.
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
