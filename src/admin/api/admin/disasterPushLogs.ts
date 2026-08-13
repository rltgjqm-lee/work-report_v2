import { queryOptions } from "@tanstack/react-query";

import type { SafetyAlert } from "../../types/safetyAlerts";

import { request } from "../client";

const listDisasterPushLogs = () => request<SafetyAlert[]>("/api/disaster-push-logs");

const disasterPushLogsKeys = {
  all: ["disaster-push-logs"] as const,
};

export const disasterPushLogsQueryOptions = queryOptions({
  queryKey: disasterPushLogsKeys.all,
  queryFn: listDisasterPushLogs,
});
