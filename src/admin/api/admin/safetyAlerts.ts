import { request } from "../client";
import type { SafetyAlert } from "../../types";

export const listSafetyAlerts = () =>
  request<SafetyAlert[]>("/api/safety-alerts");

export const sendTestSafetyAlert = (data: {
  message: string;
  programId: number;
}) =>
  request<{
    ok: true;
    alertId: string;
    targetCount: number;
    successCount: number;
  }>("/api/safety-alerts/test", {
    method: "POST",
    body: JSON.stringify(data),
  });
