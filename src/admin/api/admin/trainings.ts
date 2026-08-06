import { request } from "../client";
import type {
  ParticipantTrainingLog,
  ProjectTraining,
  TrainingCategory,
  TrainingLogRow,
  TrainingPayMode,
  TrainingSummaryRow,
} from "../../types";

export const listTrainings = (programId: number) =>
  request<ProjectTraining[]>(`/api/trainings?programId=${programId}`);

export const createTraining = (data: {
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
}) =>
  request<ProjectTraining>("/api/trainings", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTraining = (
  id: number,
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
  }>,
) =>
  request<ProjectTraining>(`/api/trainings/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const listTrainingLogs = (programId: number, trainingId?: number) =>
  request<TrainingLogRow[]>(
    `/api/trainings/logs?programId=${programId}${trainingId ? `&trainingId=${trainingId}` : ""}`,
  );

export const createTrainingLog = (data: {
  participantId: number;
  trainingId: number;
  attendDate: string;
  attendHours?: number;
}) =>
  request<ParticipantTrainingLog>("/api/trainings/logs", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTrainingLog = (
  id: number,
  data: Partial<{ attendDate: string; attendHours: number }>,
) =>
  request<ParticipantTrainingLog>(`/api/trainings/logs/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const cancelTrainingLog = (id: number) =>
  request<ParticipantTrainingLog>(`/api/trainings/logs/${id}`, {
    method: "DELETE",
  });

export const getTrainingSummary = (programId: number) =>
  request<TrainingSummaryRow[]>(`/api/trainings/summary?programId=${programId}`);
