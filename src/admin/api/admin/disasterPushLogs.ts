import { queryOptions } from "@tanstack/react-query";

import { request } from "../client";
import type { SafetyAlert } from "../../types";

export const listDisasterPushLogs = () =>
  request<SafetyAlert[]>("/api/disaster-push-logs");

export const disasterPushLogsKeys = {
  all: ["disaster-push-logs"] as const,
};

export const disasterPushLogsQueryOptions = queryOptions({
  queryKey: disasterPushLogsKeys.all,
  queryFn: listDisasterPushLogs,
});
