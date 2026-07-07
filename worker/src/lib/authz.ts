import type { Context } from "hono";

import type { Env, JwtPayload } from "../types";

export const getAuth = (c: Context<Env>): JwtPayload => c.get("jwtPayload");

export const canAccessOrg = (
  auth: JwtPayload,
  organizationId: number,
): boolean => auth.role === "super_admin" || auth.organizationId === organizationId;
