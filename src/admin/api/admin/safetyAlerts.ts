import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { request } from "../client";
import type { SafetyAlert } from "../../types";

export const listSafetyAlerts = () => request<SafetyAlert[]>("/api/safety-alerts");

export const safetyAlertsKeys = {
  all: ["safety-alerts"] as const,
};

export const safetyAlertsQueryOptions = queryOptions({
  queryKey: safetyAlertsKeys.all,
  queryFn: listSafetyAlerts,
});

export interface SendTestSafetyAlertVariables {
  message: string;
  programId: number;
}

export const sendTestSafetyAlert = (data: SendTestSafetyAlertVariables) =>
  request<{
    ok: true;
    alertId: string;
    targetCount: number;
    successCount: number;
  }>("/api/safety-alerts/test", {
    method: "POST",
    body: JSON.stringify(data),
  });

// critical: 테스트 발송이 성공하면 어느 화면에서 호출하든 재난문자 목록을 무효화해야 한다.
// 발송 결과 메시지 표시/입력창 초기화는 화면마다 다른 UI 한정 동작이라 호출부에 둔다.
export const sendTestSafetyAlertMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: sendTestSafetyAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: safetyAlertsKeys.all });
    },
  });
