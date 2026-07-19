import { request } from "../client";
import type { SafetyAlert } from "../../types";

export const listSafetyAlerts = () =>
  request<SafetyAlert[]>("/api/safety-alerts");
