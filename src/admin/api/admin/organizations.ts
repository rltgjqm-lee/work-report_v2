import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";
import type { Organization } from "../../types";

export const organizationKeys = {
  all: ["organizations"] as const,
};
export interface UpdateOrganizationVariables {
  id: number;
  data: Partial<Omit<Organization, "id" | "createdAt">>;
}

export const listOrganizations = () => request<Organization[]>("/api/organizations");

export const organizationsQueryOptions = queryOptions({
  queryKey: organizationKeys.all,
  queryFn: listOrganizations,
});

export const getOrganization = (id: number) => request<Organization>(`/api/organizations/${id}`);

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
