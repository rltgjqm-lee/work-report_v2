import { request } from "../client";
import type { SafetyAlert } from "../../types";

export const listDisasterPushLogs = () =>
  request<SafetyAlert[]>("/api/disaster-push-logs");
