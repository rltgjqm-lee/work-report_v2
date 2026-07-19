import { request } from "../client";
import type { Group } from "../../types";

export const listGroups = (programId: number) =>
  request<Group[]>(`/api/programs/${programId}/groups`);

export const createGroup = (
  programId: number,
  data: {
    name: string;
    description?: string;
    shiftStart: string;
    shiftEnd: string;
  },
) =>
  request<Group>(`/api/programs/${programId}/groups`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateGroup = (
  id: number,
  data: Partial<
    Pick<Group, "name" | "description" | "shiftStart" | "shiftEnd" | "isActive">
  >,
) =>
  request<Group>(`/api/groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const bulkAssignGroup = (participantIds: number[], groupId: number) =>
  request<{ updated: number }>("/api/groups/bulk-assign", {
    method: "POST",
    body: JSON.stringify({ participantIds, groupId }),
  });
