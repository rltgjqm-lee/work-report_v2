import { request } from "../client";

export const changeMyPassword = (
  currentPassword: string,
  newPassword: string,
) =>
  request<{ ok: true }>("/api/me/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
