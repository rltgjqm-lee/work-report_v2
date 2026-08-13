import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type { EscapeLog, EscapeRow, EscapeStatus, LiveWorker } from "../../types/escapes";

import { request } from "../client";

const escapeKeys = {
  all: ["escapes"] as const,
  byProgram: (programId: number, status: EscapeStatus | "ALL") =>
    [...escapeKeys.all, "program", programId, status] as const,
};

const getEscapes = (programId: number, status: EscapeStatus | "ALL" = "OPEN") =>
  request<EscapeRow[]>(`/api/programs/${programId}/escapes?status=${status}`);

export const escapesQueryOptions = (programId: number, status: EscapeStatus) =>
  queryOptions({
    queryKey: escapeKeys.byProgram(programId, status),
    queryFn: () => getEscapes(programId, status),
  });

// 근무 이력의 위치 열 옆에 이탈 처리 상태/메모를 같이 보여주기 위해, 상태 무관하게
// 그 사업단의 이탈 전체를 한 번에 받아 참여자+날짜로 화면에서 매칭한다.
// (참여자 상세 페이지는 참여자를 불러오기 전까진 programId를 몰라 undefined로 호출한다.)
export const allProgramEscapesQueryOptions = (programId: number | undefined) =>
  queryOptions({
    queryKey: escapeKeys.byProgram(programId ?? 0, "ALL"),
    queryFn: () => getEscapes(programId as number, "ALL"),
    enabled: !!programId,
  });

const liveWorkerKeys = {
  all: ["live-workers"] as const,
  byProgram: (programId: number) => [...liveWorkerKeys.all, programId] as const,
};

const getLiveWorkers = (programId: number) =>
  request<LiveWorker[]>(`/api/programs/${programId}/workers/live`);

export const liveWorkersQueryOptions = (programId: number) =>
  queryOptions({
    queryKey: liveWorkerKeys.byProgram(programId),
    queryFn: () => getLiveWorkers(programId),
  });

export interface ResolveEscapeVariables {
  escapeId: number;
  programId: number;
  memo?: string;
}

const resolveEscape = (id: number, memo?: string) =>
  request<EscapeLog>(`/api/escapes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ memo }),
  });

// critical: 이탈이 해결되면 그 사업단의 OPEN/RESOLVED 이탈 목록이 둘 다 바뀐다 —
// escapeKeys.all로 이 도메인 전체(모든 사업단·상태)를 한 번에 무효화한다.
export const resolveEscapeMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ escapeId, memo }: ResolveEscapeVariables) => resolveEscape(escapeId, memo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: escapeKeys.all });
    },
  });

export interface MarkEscapeAlertedVariables {
  escapeId: number;
  programId: number;
}

const markEscapeAlerted = (id: number) =>
  request<EscapeLog>(`/api/escapes/${id}/alerted`, { method: "POST" });

export const markEscapeAlertedMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ escapeId }: MarkEscapeAlertedVariables) => markEscapeAlerted(escapeId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: escapeKeys.byProgram(variables.programId, "OPEN"),
      });
    },
  });
