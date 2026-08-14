import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import type { EscapeLog, EscapeRow, EscapeStatus, LiveWorker } from "../../types/escapes";

import { request } from "../client";

const escapeKeys = {
  all: ["escapes"] as const,
  byProgram: (programId: number, status: EscapeStatus) =>
    [...escapeKeys.all, "program", programId, status] as const,
};

const getEscapes = (programId: number, status: EscapeStatus) =>
  request<EscapeRow[]>(`/api/programs/${programId}/escapes?status=${status}`);

export const escapesQueryOptions = (programId: number, status: EscapeStatus) =>
  queryOptions({
    queryKey: escapeKeys.byProgram(programId, status),
    queryFn: () => getEscapes(programId, status),
  });

const liveMapKeys = {
  all: ["live-map"] as const,
  byProgram: (programId: number) => [...liveMapKeys.all, programId] as const,
};

export interface LiveMap {
  workers: LiveWorker[];
  openEscapes: EscapeRow[];
}

// 안전 관제 지도용 — 실시간 근무자 위치와 확인 필요(OPEN) 이탈을 한 번에 받는다.
// 둘 다 10초 폴링으로 같이 쓰는 데이터라 폴링 요청을 하나로 묶는다.
const getLiveMap = (programId: number) => request<LiveMap>(`/api/programs/${programId}/live-map`);

export const liveMapQueryOptions = (programId: number) =>
  queryOptions({
    queryKey: liveMapKeys.byProgram(programId),
    queryFn: () => getLiveMap(programId),
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

// critical: 이탈이 해결되면 그 사업단의 RESOLVED 이탈 목록(escapeKeys.all — 이 도메인
// 전체를 한 번에 무효화)과, 안전 관제 지도의 OPEN 이탈(liveMapKeys)이 둘 다 바뀐다.
export const resolveEscapeMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ escapeId, memo }: ResolveEscapeVariables) => resolveEscape(escapeId, memo),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: escapeKeys.all });
      queryClient.invalidateQueries({ queryKey: liveMapKeys.byProgram(variables.programId) });
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
      queryClient.invalidateQueries({ queryKey: liveMapKeys.byProgram(variables.programId) });
    },
  });
