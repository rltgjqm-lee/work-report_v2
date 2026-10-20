import { lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { clientEvents } from "../db/schema";
import { getKstNow } from "../lib/kst";
import type { Env } from "../types";

// 앱 실패 기록(client_events)은 원인 진단용이라 30일만 둔다 — 하루 한 번(KST 18:00) 지운다.
const RETENTION_DAYS = 30;

export const deleteOldClientEvents = async (env: Env["Bindings"]): Promise<void> => {
  const db = drizzle(env.DB);
  const { iso } = getKstNow();
  const cutoff = new Date(Date.parse(iso) - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.delete(clientEvents).where(lt(clientEvents.receivedAt, cutoff));
};
