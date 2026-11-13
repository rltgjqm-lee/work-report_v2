import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";

export type ActivityOptionCategory = "CONTENT" | "PLACE";

export interface ProgramActivityOption {
  id: number;
  programId: number;
  category: ActivityOptionCategory;
  label: string;
  createdAt: string;
}

const programActivityOptionKeys = {
  all: ["program-activity-options"] as const,
  byProgram: (programId: number) => [...programActivityOptionKeys.all, programId] as const,
};

const listProgramActivityOptions = (programId: number) =>
  request<ProgramActivityOption[]>(`/api/program-activity-options?programId=${programId}`);

export const programActivityOptionsQueryOptions = (programId: number) =>
  queryOptions({
    queryKey: programActivityOptionKeys.byProgram(programId),
    queryFn: () => listProgramActivityOptions(programId),
  });

export interface CreateProgramActivityOptionVariables {
  programId: number;
  category: ActivityOptionCategory;
  label: string;
}

const createProgramActivityOption = (data: CreateProgramActivityOptionVariables) =>
  request<ProgramActivityOption>("/api/program-activity-options", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createProgramActivityOptionMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: createProgramActivityOption,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: programActivityOptionKeys.byProgram(variables.programId),
      });
    },
  });

export interface DeleteProgramActivityOptionVariables {
  id: number;
  programId: number;
}

const deleteProgramActivityOption = (id: number) =>
  request<{ success: boolean }>(`/api/program-activity-options/${id}`, { method: "DELETE" });

export const deleteProgramActivityOptionMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id }: DeleteProgramActivityOptionVariables) => deleteProgramActivityOption(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: programActivityOptionKeys.byProgram(variables.programId),
      });
    },
  });
