import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";
import type { Group } from "../../types";

export const groupKeys = {
  all: ["groups"] as const,
  byProgram: (programId: number) => [...groupKeys.all, "program", programId] as const,
};

export const listGroups = (programId: number) =>
  request<Group[]>(`/api/programs/${programId}/groups`);

export const groupsQueryOptions = (programId: number) =>
  queryOptions({
    queryKey: groupKeys.byProgram(programId),
    queryFn: () => listGroups(programId),
  });

export interface CreateGroupVariables {
  programId: number;
  data: {
    name: string;
    description?: string;
    shiftStart: string;
    shiftEnd: string;
  };
}

export const createGroup = (programId: number, data: CreateGroupVariables["data"]) =>
  request<Group>(`/api/programs/${programId}/groups`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createGroupMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ programId, data }: CreateGroupVariables) => createGroup(programId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

export interface UpdateGroupVariables {
  id: number;
  programId: number;
  data: Partial<Pick<Group, "name" | "description" | "shiftStart" | "shiftEnd" | "isActive">>;
}

export const updateGroup = (id: number, data: UpdateGroupVariables["data"]) =>
  request<Group>(`/api/groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// programId는 서버에 보내는 값이 아니라 캐시 무효화 대상(그 사업단의 조 목록)을 찾기 위한 것 —
// participantCount가 활성 인원만 세므로 활성/비활성 토글도 조 목록을 무효화해야 한다.
export const updateGroupMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, data }: UpdateGroupVariables) => updateGroup(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.byProgram(variables.programId) });
    },
  });

export const bulkAssignGroup = (participantIds: number[], groupId: number) =>
  request<{ updated: number }>("/api/groups/bulk-assign", {
    method: "POST",
    body: JSON.stringify({ participantIds, groupId }),
  });
