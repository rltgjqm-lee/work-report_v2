import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";

export type TrainingCategory = "PRE" | "DURING";
export type TrainingPayMode = "WORK" | "HOURLY" | "DAILY" | "NONE";

export type ProjectTraining = {
  id: number;
  programId: number;
  name: string;
  category: TrainingCategory;
  trainingDate: string | null;
  startTime: string | null;
  endTime: string | null;
  isPaid: boolean;
  payMode: TrainingPayMode;
  hours: number | null;
  dailyWage: number | null;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
};

type TrainingLogStatus = "COMPLETED" | "CANCELLED";

export type ParticipantTrainingLog = {
  id: number;
  participantId: number;
  trainingId: number;
  attendDate: string;
  attendHours: number;
  payAmount: number;
  status: TrainingLogStatus;
  createdAt: string;
};

export type TrainingLogRow = {
  log: ParticipantTrainingLog;
  participantName: string;
  trainingName: string;
};

export type TrainingComplianceRow = {
  participantId: number;
  participantName: string;
  missingTrainings: { id: number; name: string }[];
};

export const trainingsKeys = {
  all: ["trainings"] as const,
  definitions: (programId: number) => [...trainingsKeys.all, "definitions", programId] as const,
  logs: (programId: number) => [...trainingsKeys.all, "logs", programId] as const,
  logsFiltered: (programId: number, trainingId: number | undefined) =>
    [...trainingsKeys.logs(programId), trainingId ?? "all"] as const,
  compliance: (programId: number) => [...trainingsKeys.all, "compliance", programId] as const,
};

const listTrainings = (programId: number) =>
  request<ProjectTraining[]>(`/api/trainings?programId=${programId}`);

export const trainingsQueryOptions = (programId: number) =>
  queryOptions({
    queryKey: trainingsKeys.definitions(programId),
    queryFn: () => listTrainings(programId),
  });

export interface CreateTrainingVariables {
  programId: number;
  name: string;
  category: TrainingCategory;
  trainingDate?: string;
  startTime?: string;
  endTime?: string;
  isPaid?: boolean;
  payMode?: TrainingPayMode;
  hours?: number;
  dailyWage?: number;
  isRequired?: boolean;
}

const createTraining = (data: CreateTrainingVariables) =>
  request<ProjectTraining>("/api/trainings", {
    method: "POST",
    body: JSON.stringify(data),
  });

// critical: 새 교육이 목록에 들어가고, 필수교육이면 미이수자 현황에도 영향을 준다.
export const createTrainingMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: createTraining,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: trainingsKeys.definitions(variables.programId) });
      queryClient.invalidateQueries({ queryKey: trainingsKeys.compliance(variables.programId) });
    },
  });

export interface UpdateTrainingVariables {
  id: number;
  // 서버로 보내는 값이 아니라, 성공 후 어느 사업단의 쿼리를 무효화할지 찾기 위한 값이다.
  programId: number;
  data: Partial<{
    name: string;
    category: TrainingCategory;
    trainingDate: string;
    startTime: string;
    endTime: string;
    isPaid: boolean;
    payMode: TrainingPayMode;
    hours: number;
    dailyWage: number;
    isRequired: boolean;
    isActive: boolean;
  }>;
}

const updateTraining = (id: number, data: UpdateTrainingVariables["data"]) =>
  request<ProjectTraining>(`/api/trainings/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// critical: 수정/활성화토글이 필수여부·활성상태를 바꿀 수 있어 미이수자 현황도 같이 무효화한다.
export const updateTrainingMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, data }: UpdateTrainingVariables) => updateTraining(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: trainingsKeys.definitions(variables.programId) });
      queryClient.invalidateQueries({ queryKey: trainingsKeys.compliance(variables.programId) });
    },
  });

const listTrainingLogs = (programId: number, trainingId?: number) =>
  request<TrainingLogRow[]>(
    `/api/trainings/logs?programId=${programId}${trainingId ? `&trainingId=${trainingId}` : ""}`,
  );

export const trainingLogsQueryOptions = (
  programId: number,
  trainingId: number | undefined,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: trainingsKeys.logsFiltered(programId, trainingId),
    queryFn: () => listTrainingLogs(programId, trainingId),
    enabled,
  });

export interface CreateTrainingLogVariables {
  programId: number;
  participantId: number;
  trainingId: number;
  attendDate: string;
  attendHours?: number;
}

const createTrainingLog = (data: {
  participantId: number;
  trainingId: number;
  attendDate: string;
  attendHours?: number;
}) =>
  request<ParticipantTrainingLog>("/api/trainings/logs", {
    method: "POST",
    body: JSON.stringify(data),
  });

// critical: 새 이수 기록이 이수 현황 목록과 필수교육 미이수자 현황 둘 다에 영향을 준다.
export const createTrainingLogMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({
      participantId,
      trainingId,
      attendDate,
      attendHours,
    }: CreateTrainingLogVariables) =>
      createTrainingLog({ participantId, trainingId, attendDate, attendHours }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: trainingsKeys.logs(variables.programId) });
      queryClient.invalidateQueries({ queryKey: trainingsKeys.compliance(variables.programId) });
    },
  });

export interface CancelTrainingLogVariables {
  logId: number;
  programId: number;
}

const cancelTrainingLog = (id: number) =>
  request<ParticipantTrainingLog>(`/api/trainings/logs/${id}`, {
    method: "DELETE",
  });

export const cancelTrainingLogMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ logId }: CancelTrainingLogVariables) => cancelTrainingLog(logId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: trainingsKeys.logs(variables.programId) });
      queryClient.invalidateQueries({ queryKey: trainingsKeys.compliance(variables.programId) });
    },
  });

const getTrainingCompliance = (programId: number) =>
  request<TrainingComplianceRow[]>(`/api/trainings/summary?programId=${programId}`);

export const trainingComplianceQueryOptions = (programId: number, enabled: boolean) =>
  queryOptions({
    queryKey: trainingsKeys.compliance(programId),
    queryFn: () => getTrainingCompliance(programId),
    enabled,
  });
