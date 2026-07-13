import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";

import {
  programs,
  pushSubscriptions,
  processedDisasterMessages,
  disasterPushLogs,
} from "../db/schema";
import { fetchRecentDisasterMessages } from "../lib/disasterMsgApi";
import { sendWebPush } from "../lib/webPush";
import type { Env } from "../types";

const getKstNow = () => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const iso = kst.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};

export const checkDisasterAlerts = async (
  env: Env["Bindings"],
): Promise<void> => {
  const db = drizzle(env.DB);

  const messages = await fetchRecentDisasterMessages(env.DISASTER_API_KEY);
  if (messages.length === 0) return;

  const processedRows = await db
    .select({ id: processedDisasterMessages.id })
    .from(processedDisasterMessages);
  const processedIds = new Set(processedRows.map((r) => r.id));
  const newMessages = messages.filter((m) => !processedIds.has(m.id));
  if (newMessages.length === 0) return;

  const { date, time } = getKstNow();
  const allPrograms = await db.select().from(programs);

  for (const message of newMessages) {
    const matchingPrograms = allPrograms.filter((p) => {
      if (!p.regionSido || !p.regionSigungu) return false;
      if (
        !message.region.includes(p.regionSido) ||
        !message.region.includes(p.regionSigungu)
      ) {
        return false;
      }
      if (date < p.startDate || date > p.endDate) return false;
      if (time < p.startTime || time > p.endTime) return false;
      return true;
    });

    if (matchingPrograms.length > 0) {
      const programIds = matchingPrograms.map((p) => p.id);
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.programId, programIds));

      for (const sub of subscriptions) {
        const result = await sendWebPush(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          { title: "🚨 재난문자", body: message.message },
          { privateJWK: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT },
        );

        await db.insert(disasterPushLogs).values({
          programId: sub.programId,
          messageId: message.id,
          endpoint: sub.endpoint,
          success: result.ok,
        });

        if (!result.ok && result.expired) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }

    await db
      .insert(processedDisasterMessages)
      .values({ id: message.id })
      .onConflictDoNothing();
  }
};
