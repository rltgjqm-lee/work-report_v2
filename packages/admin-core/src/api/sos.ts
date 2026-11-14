import { mutationOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";
import type { SosEvent } from "../types/sos";
import { liveMapKeys } from "./escapes";
import { mobileKeys } from "./mobile";

export interface ResolveSosVariables {
  sosId: number;
  programId: number;
  memo?: string;
}

const resolveSos = (id: number, memo?: string) =>
  request<SosEvent>(`/api/sos/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ memo }),
  });

// critical: SOS가 해결되면 안전 관제 지도의 OPEN SOS 목록(liveMapKeys)과 관리자 앱의
// 안전·홈·상세 화면(mobileKeys)이 바뀐다.
export const resolveSosMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ sosId, memo }: ResolveSosVariables) => resolveSos(sosId, memo),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: liveMapKeys.byProgram(variables.programId) });
      queryClient.invalidateQueries({ queryKey: mobileKeys.all });
    },
  });

export interface MarkSosNotifiedVariables {
  sosId: number;
  programId: number;
}

const markSosNotified = (id: number) =>
  request<SosEvent>(`/api/sos/${id}/notified`, { method: "POST" });

export const markSosNotifiedMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ sosId }: MarkSosNotifiedVariables) => markSosNotified(sosId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: liveMapKeys.byProgram(variables.programId) });
    },
  });
