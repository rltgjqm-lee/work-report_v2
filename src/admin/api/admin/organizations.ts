import { request } from "../client";
import type { Organization } from "../../types";

export const listOrganizations = () =>
  request<Organization[]>("/api/organizations");

export const getOrganization = (id: number) =>
  request<Organization>(`/api/organizations/${id}`);

export const createOrganization = (
  data: Partial<Omit<Organization, "id" | "createdAt">>,
) =>
  request<Organization>("/api/organizations", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateOrganization = (
  id: number,
  data: Partial<Omit<Organization, "id" | "createdAt">>,
) =>
  request<Organization>(`/api/organizations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
