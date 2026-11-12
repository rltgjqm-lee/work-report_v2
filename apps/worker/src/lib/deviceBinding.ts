import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { participants } from "../db/schema";
import { getKstNow } from "./kst";

type DB = ReturnType<typeof drizzle>;
type Participant = typeof participants.$inferSelect;

export const DEVICE_MISMATCH_MESSAGE =
  "이미 다른 기기에 등록되어 있어요. 기관 담당자에게 기기 등록 해제를 요청해주세요.";

// 기기 번호는 앱이 만든 UUID다 — 형식이 이상한 값은 없는 것으로 본다
const isValidDeviceId = (deviceId: unknown): deviceId is string =>
  typeof deviceId === "string" && deviceId.length >= 8 && deviceId.length <= 64;

/**
 * 이 기기로 이 참여자를 쓸 수 있는지 확인하고, 아직 고정된 기기가 없으면 이 기기로 고정한다.
 *
 * 기기 번호가 없는 요청(기기 고정이 들어가기 전 OTA 화면을 쓰는 앱)은 막지 않는다 — 바로 막으면
 * 업데이트를 아직 못 받은 참여자가 출근을 못 한다. 업데이트를 받으면 그때부터 고정된다.
 */
export const checkAndBindDevice = async (
  db: DB,
  participant: Participant,
  deviceId: unknown,
): Promise<boolean> => {
  if (!isValidDeviceId(deviceId)) return true;
  if (participant.boundDeviceId) return participant.boundDeviceId === deviceId;

  // 두 기기가 동시에 처음 등록하는 경우에도 한 기기만 고정되도록 "아직 비어 있을 때만" 쓴다
  const bound = await db
    .update(participants)
    .set({ boundDeviceId: deviceId, boundDeviceAt: getKstNow().iso })
    .where(and(eq(participants.id, participant.id), isNull(participants.boundDeviceId)))
    .returning({ boundDeviceId: participants.boundDeviceId });
  if (bound[0]) return true;

  const latest = await db
    .select({ boundDeviceId: participants.boundDeviceId })
    .from(participants)
    .where(eq(participants.id, participant.id));
  return latest[0]?.boundDeviceId === deviceId;
};
