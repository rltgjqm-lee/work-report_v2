import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";

import { request } from "../client";
import type { Organization } from "../../types";

export const listOrganizations = () =>
  request<Organization[]>("/api/organizations");

export const organizationKeys = {
  all: ["organizations"] as const,
};

export const organizationsQueryOptions = queryOptions({
  queryKey: organizationKeys.all,
  queryFn: listOrganizations,
});

export const getOrganization = (id: number) =>
  request<Organization>(`/api/organizations/${id}`);

export const createOrganization = (
  data: Partial<Omit<Organization, "id" | "createdAt">>,
) =>
  request<Organization>("/api/organizations", {
    method: "POST",
    body: JSON.stringify(data),
  });

// critical: 생성/수정 성공 시 어느 화면에서 호출하든 기관 목록을 무효화해야 한다.
// 모달 닫기/에러 표시 같은 UI 한정 동작은 호출부의 mutate(variables, { onSuccess, onError })에 둔다.
export const createOrganizationMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });

export const updateOrganization = (
  id: number,
  data: Partial<Omit<Organization, "id" | "createdAt">>,
) =>
  request<Organization>(`/api/organizations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export interface UpdateOrganizationVariables {
  id: number;
  data: Partial<Omit<Organization, "id" | "createdAt">>;
}

export const updateOrganizationMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, data }: UpdateOrganizationVariables) =>
      updateOrganization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
