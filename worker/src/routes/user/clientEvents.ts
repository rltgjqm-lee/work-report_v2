import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import type { Env } from "../../types";

import { clientEvents, participants } from "../../db/schema";
import { getKstNow } from "../../lib/kst";

const app = new Hono<Env>();

type ClientEventKind = (typeof clientEvents.$inferSelect)["kind"];

const KINDS: ClientEventKind[] = ["CLOCK_IN", "CLOCK_OUT", "ACTIVITY_LOG_SYNC"];
// 인증 없는 /public 엔드포인트라 한 번에 받는 양과 문자열 길이를 묶어둔다
const MAX_EVENTS_PER_REQUEST = 50;
const MAX_MESSAGE_LENGTH = 500;
const MAX_META_LENGTH = 40;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KST_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

type IncomingEvent = {
  kind?: string;
  workDate?: string;
  occurredAt?: string;
  message?: string;
  httpStatus?: number | null;
  online?: boolean | null;
  connectionType?: string | null;
  occurrences?: number;
};

const shorten = (value: unknown, maxLength: number): string | null =>
  typeof value === "string" && value !== "" ? value.slice(0, maxLength) : null;

// 참여자 앱이 서버에 닿지 못한 실패(출퇴근 전송 실패, 업무일지·서명 미전송)를 폰에 모아뒀다가
// 다음에 연결됐을 때 보낼 게 있을 때만 한 번에 보낸다(client_events 참고).
// 같은 참여자·종류·근무일·사유는 새 행을 만들지 않고 횟수와 마지막 발생 시각만 갱신한다 —
// 앱을 열 때마다 "아직 미전송" 보고가 와도 행이 쌓이지 않게 한다.
app.post("/", async (c) => {
  const body = await c.req
    .json<{
      participantId?: number;
      platform?: string;
      appVersion?: string;
      bundleVersion?: string;
      events?: IncomingEvent[];
    }>()
    .catch(() => null);
  if (!body?.participantId || !Array.isArray(body.events) || body.events.length === 0) {
    return c.json({ error: "참여자와 이벤트를 지정해주세요." }, 400);
  }
  if (body.events.length > MAX_EVENTS_PER_REQUEST) {
    return c.json({ error: "이벤트가 너무 많습니다." }, 400);
  }

  const db = drizzle(c.env.DB);
  const participantRows = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.id, body.participantId));
  if (!participantRows[0]) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);

  const { iso } = getKstNow();
  const platform = shorten(body.platform, MAX_META_LENGTH);
  const appVersion = shorten(body.appVersion, MAX_META_LENGTH);
  const bundleVersion = shorten(body.bundleVersion, MAX_META_LENGTH);

  let saved = 0;
  for (const event of body.events) {
    const kind = KINDS.find((candidate) => candidate === event.kind);
    const workDate = event.workDate && DATE_PATTERN.test(event.workDate) ? event.workDate : null;
    const message = shorten(event.message, MAX_MESSAGE_LENGTH);
    if (!kind || !workDate || !message) continue;

    const occurredAt =
      event.occurredAt && KST_ISO_PATTERN.test(event.occurredAt) ? event.occurredAt : iso;
    const occurrences =
      Number.isInteger(event.occurrences) && event.occurrences! > 0
        ? Math.min(event.occurrences!, 1000)
        : 1;
    const fields = {
      httpStatus: Number.isInteger(event.httpStatus) ? event.httpStatus! : null,
      online: typeof event.online === "boolean" ? event.online : null,
      connectionType: shorten(event.connectionType, MAX_META_LENGTH),
      platform,
      appVersion,
      bundleVersion,
    };

    const existingRows = await db
      .select()
      .from(clientEvents)
      .where(
        and(
          eq(clientEvents.participantId, body.participantId),
          eq(clientEvents.kind, kind),
          eq(clientEvents.workDate, workDate),
          eq(clientEvents.message, message),
        ),
      );
    const existing = existingRows[0];

    if (existing) {
      await db
        .update(clientEvents)
        .set({
          ...fields,
          occurrences: existing.occurrences + occurrences,
          lastOccurredAt:
            occurredAt > existing.lastOccurredAt ? occurredAt : existing.lastOccurredAt,
          receivedAt: iso,
        })
        .where(eq(clientEvents.id, existing.id));
    } else {
      await db.insert(clientEvents).values({
        ...fields,
        participantId: body.participantId,
        kind,
        workDate,
        firstOccurredAt: occurredAt,
        lastOccurredAt: occurredAt,
        receivedAt: iso,
        occurrences,
        message,
      });
    }
    saved++;
  }

  return c.json({ ok: true, saved });
});

export default app;
