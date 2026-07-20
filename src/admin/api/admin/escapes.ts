import { request } from "../client";
import type { EscapeLog } from "../../types";

export const resolveEscape = (id: number, memo?: string) =>
  request<EscapeLog>(`/api/escapes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ memo }),
  });
