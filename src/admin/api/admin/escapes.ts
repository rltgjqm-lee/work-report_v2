import { request } from "../client";
import type { EscapeLog } from "../../types";

export const resolveEscape = (id: number, memo?: string) =>
  request<EscapeLog>(`/api/escapes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ memo }),
  });

export const markEscapeAlerted = (id: number) =>
  request<EscapeLog>(`/api/escapes/${id}/alerted`, { method: "POST" });
