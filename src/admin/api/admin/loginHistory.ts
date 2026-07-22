import { request } from "../client";
import type { LoginHistoryEntry } from "../../types";

export const listLoginHistory = () =>
  request<LoginHistoryEntry[]>("/api/admins/login-history");
