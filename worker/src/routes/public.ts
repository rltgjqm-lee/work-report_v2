import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, like } from "drizzle-orm";

import {
  organizations,
  programs,
  pushSubscriptions,
  participants,
  groups,
  demandSites,
  escapeLogs,
  participantEscapeMeta,
  attendanceLogs,
  activityLogs,
} from "../db/schema";
import { getKstNow } from "../lib/kst";
import { haversineKm } from "../lib/geo";
import { sendWebPush } from "../lib/webPush";
import type { Env } from "../types";

const app = new Hono<Env>();

// "HH:MM" -> 자정 기준 분
const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

// 기관/사업단 목록을 한 번에 반환 — 기본 정보 입력 페이지의 지역/기관/사업단
// 캐스케이딩 드롭다운이 라운드트립 없이 한 번의 호출로 채워지도록 묶어서 내려준다.
app.get("/affiliations", async (c) => {
  const db = drizzle(c.env.DB);

  const [organizationRows, programRows] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        regionSido: organizations.regionSido,
        regionSigungu: organizations.regionSigungu,
        organizationType: organizations.organizationType,
      })
      .from(organizations)
      .where(eq(organizations.isActive, true)),
    db
      .select({
        id: programs.id,
        name: programs.name,
        organizationId: programs.organizationId,
        startDate: programs.startDate,
        endDate: programs.endDate,
        startTime: programs.startTime,
        endTime: programs.endTime,
        programType: programs.programType,
      })
      .from(programs)
      .where(eq(programs.isActive, true)),
  ]);

  return c.json({ organizations: organizationRows, programs: programRows });
});

app.post("/push-subscriptions", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    programId?: number;
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  }>();

  if (
    !body.programId ||
    !body.endpoint ||
    !body.keys?.p256dh ||
    !body.keys?.auth
  ) {
    return c.json(
      { error: "programId, endpoint, keys.p256dh, keys.auth are required" },
      400,
    );
  }

  const result = await db
    .insert(pushSubscriptions)
    .values({
      programId: body.programId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        programId: body.programId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    })
    .returning();

  return c.json(result[0], 201);
});

// 최초 구독 등록(위) 시점엔 아직 참여자가 특정되지 않아 programId로만 저장된다.
// 출근 식별(identify) 이후 이 엔드포인트로 구독을 참여자 한 명에 연결해야
// 이탈 경고처럼 그 사람에게만 보내야 하는 푸시(1단계)가 가능해진다.
app.post("/push-subscriptions/link-participant", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    endpoint?: string;
    participantId?: number;
  }>();

  if (!body.endpoint || !body.participantId) {
    return c.json({ error: "endpoint, participantId are required" }, 400);
  }

  const result = await db
    .update(pushSubscriptions)
    .set({ participantId: body.participantId })
    .where(eq(pushSubscriptions.endpoint, body.endpoint))
    .returning();

  if (!result[0]) return c.json({ error: "Not found" }, 404);
  return c.json(result[0]);
});

// 참여자 셀프 근태체크 — 이름+전화번호 뒤4자리로 본인 확인 (등록 시 동명이인 구분에
// 쓰인 조합과 동일). 로그인/개인 UID 없이, 클라이언트가 응답의 participantId를
// 로컬스토리지에 저장해두고 이후 출퇴근에 재사용한다.
app.post("/attendance/identify", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    programId?: number;
    name?: string;
    phoneLast4?: string;
  }>();

  if (!body.programId || !body.name || !body.phoneLast4) {
    return c.json({ error: "programId, name, phoneLast4 are required" }, 400);
  }

  const rows = await db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.programId, body.programId),
        eq(participants.name, body.name),
        eq(participants.phoneLast4, body.phoneLast4),
      ),
    );

  const participant = rows[0];
  if (!participant) {
    return c.json({ error: "일치하는 참여자를 찾을 수 없습니다." }, 404);
  }

  return c.json({ participantId: participant.id, name: participant.name });
});

app.post("/attendance/clock-in", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ participantId?: number }>();
  if (!body.participantId) {
    return c.json({ error: "participantId is required" }, 400);
  }

  const rows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, body.participantId));
  const participant = rows[0];
  if (!participant) return c.json({ error: "Not found" }, 404);

  if (participant.status === "ON_LEAVE") {
    return c.json({ error: "휴가 중인 참여자는 출근할 수 없습니다." }, 400);
  }

  const { date, time, iso } = getKstNow();

  // 배정된 조에 근무시간이 설정돼 있으면 그 시간 ±30분 범위에서만 출근을 허용한다.
  // 조 미배정/근무시간 미설정 상태에서는 검증을 건너뛴다 (아직 조 편성을 안 한 사업단도 있어서).
  if (participant.groupId) {
    const groupRows = await db
      .select()
      .from(groups)
      .where(eq(groups.id, participant.groupId));
    const group = groupRows[0];

    if (group) {
      const nowMinutes = toMinutes(time);
      const earliest = toMinutes(group.shiftStart) - 30;
      const latest = toMinutes(group.shiftEnd) + 30;

      if (nowMinutes < earliest) {
        return c.json(
          { error: `아직 근무 시작 시간(${group.shiftStart})이 아닙니다.` },
          400,
        );
      }
      if (nowMinutes > latest) {
        return c.json(
          { error: `이미 근무 종료 시간(${group.shiftEnd})이 지났습니다.` },
          400,
        );
      }
    }
  }

  const existing = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.participantId, participant.id),
        eq(attendanceLogs.workDate, date),
      ),
    );
  if (existing.length > 0) {
    return c.json({ error: "이미 출근 처리되었습니다." }, 400);
  }

  const result = await db
    .insert(attendanceLogs)
    .values({
      participantId: participant.id,
      groupId: participant.groupId,
      programId: participant.programId,
      workDate: date,
      clockIn: iso,
    })
    .returning();

  return c.json(result[0], 201);
});

app.post("/attendance/clock-out", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ participantId?: number }>();
  if (!body.participantId) {
    return c.json({ error: "participantId is required" }, 400);
  }

  const { date, iso } = getKstNow();

  const rows = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.participantId, body.participantId),
        eq(attendanceLogs.workDate, date),
        isNull(attendanceLogs.clockOut),
      ),
    );
  const log = rows[0];
  if (!log || !log.clockIn) {
    return c.json({ error: "출근 기록이 없습니다." }, 404);
  }

  const totalMinutes = Math.floor(
    (new Date(iso).getTime() - new Date(log.clockIn).getTime()) / 60000,
  );

  // 배정된 조의 근무시간이 있으면 지각/조퇴를 자동 판정한다 (±10분 여유)
  let status: "NORMAL" | "LATE" | "EARLY_LEAVE" = "NORMAL";
  let note: string | undefined;

  if (log.groupId) {
    const groupRows = await db
      .select()
      .from(groups)
      .where(eq(groups.id, log.groupId));
    const group = groupRows[0];

    if (group) {
      const startMinutes = toMinutes(group.shiftStart);
      const endMinutes = toMinutes(group.shiftEnd);
      const expectedMinutes = endMinutes - startMinutes;
      const clockInMinutes = toMinutes(log.clockIn.slice(11, 16));

      if (totalMinutes < expectedMinutes - 10) {
        status = "EARLY_LEAVE";
        note = `조퇴 (예상: ${expectedMinutes}분, 실제: ${totalMinutes}분)`;
      } else if (clockInMinutes > startMinutes + 10) {
        status = "LATE";
        note = `지각 (예상 시작: ${group.shiftStart})`;
      }
    }
  }

  const result = await db
    .update(attendanceLogs)
    .set({ clockOut: iso, totalMinutes, status, note })
    .where(eq(attendanceLogs.id, log.id))
    .returning();

  return c.json(result[0]);
});

// 역량활동 하루 근무 종료 후 참여자 서명 수집. base64를 거치지 않고 이미지 바이너리를
// 그대로 요청 body로 받아 R2에 저장한다 — attendance_logs에는 객체 키만 남긴다.
// (엑셀 출력 시 서버가 R2에서 읽어 base64로 되돌려준다: 그건 export 응답 JSON에만 필요)
app.post("/attendance/sign", async (c) => {
  const db = drizzle(c.env.DB);
  const participantId = Number(c.req.query("participantId"));
  if (!participantId) {
    return c.json({ error: "participantId is required" }, 400);
  }

  const contentType = c.req.header("Content-Type") || "image/png";
  const extension = contentType.split("/")[1]?.split(";")[0] || "png";
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) {
    return c.json({ error: "서명 이미지가 비어있습니다." }, 400);
  }

  const { date } = getKstNow();

  const rows = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.participantId, participantId),
        eq(attendanceLogs.workDate, date),
      ),
    );
  const log = rows[0];
  if (!log) return c.json({ error: "근태 기록이 없습니다." }, 404);

  const key = `signatures/${log.programId}/${date.slice(0, 7)}/${log.participantId}/${log.id}.${extension}`;
  await c.env.SIGNATURES_BUCKET.put(key, bytes, {
    httpMetadata: { contentType },
  });

  const result = await db
    .update(attendanceLogs)
    .set({ signatureKey: key })
    .where(eq(attendanceLogs.id, log.id))
    .returning();

  return c.json(result[0]);
});

// 참여자 PWA(또는 향후 하이브리드 앱)가 출근 중일 때 주기적으로 위치를 보고하는 엔드포인트.
// 배정된 수요처 반경을 벗어났는지 판정하고, 새로 벗어난 경우에만 이탈 이벤트를 기록한다
// (반경 밖에 계속 있는 동안 매 호출마다 새로 기록하지 않음 — 벗어난 "사건" 단위로 집계).
app.post("/location", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    participantId?: number;
    lat?: number;
    lng?: number;
  }>();

  if (!body.participantId || body.lat === undefined || body.lng === undefined) {
    return c.json({ error: "participantId, lat, lng are required" }, 400);
  }

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, body.participantId));
  const participant = participantRows[0];
  if (!participant) return c.json({ error: "Not found" }, 404);

  const { date, iso } = getKstNow();

  const openAttendance = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.participantId, participant.id),
        eq(attendanceLogs.workDate, date),
        isNull(attendanceLogs.clockOut),
      ),
    );
  if (openAttendance.length === 0) {
    return c.json({ ok: true, escaped: false, message: "출근 중이 아닙니다." });
  }

  const metaRows = await db
    .select()
    .from(participantEscapeMeta)
    .where(eq(participantEscapeMeta.participantId, participant.id));
  const meta = metaRows[0];

  const saveMeta = (fields: {
    alertCount?: number;
    outsideStart?: string | null;
  }) =>
    meta
      ? db
          .update(participantEscapeMeta)
          .set({
            ...fields,
            lastLat: body.lat,
            lastLng: body.lng,
            lastLocationAt: iso,
            // 새 위치가 들어왔으니 통신 끊김 상태는 해제
            signalLossAlertedAt: null,
            updatedAt: iso,
          })
          .where(eq(participantEscapeMeta.participantId, participant.id))
      : db.insert(participantEscapeMeta).values({
          participantId: participant.id,
          alertCount: fields.alertCount ?? 0,
          outsideStart: fields.outsideStart ?? null,
          lastLat: body.lat,
          lastLng: body.lng,
          lastLocationAt: iso,
        });

  if (!participant.demandSiteId) {
    await saveMeta({});
    return c.json({ ok: true, escaped: false, message: "수요처 미배정" });
  }

  const demandSiteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, participant.demandSiteId));
  const demandSite = demandSiteRows[0];
  if (!demandSite) {
    await saveMeta({});
    return c.json({
      ok: true,
      escaped: false,
      message: "수요처 정보를 찾을 수 없습니다.",
    });
  }

  const distanceKm = haversineKm(
    body.lat,
    body.lng,
    demandSite.baseLat,
    demandSite.baseLng,
  );
  const limitKm = demandSite.allowedRadius / 1000;
  const currentAlertCount = meta?.alertCount ?? 0;

  if (distanceKm > limitKm) {
    const isNewEscape = !meta?.outsideStart;
    const newAlertCount = isNewEscape
      ? currentAlertCount + 1
      : currentAlertCount;

    if (isNewEscape) {
      await db.insert(escapeLogs).values({
        participantId: participant.id,
        programId: participant.programId,
        demandSiteId: demandSite.id,
        detectedAt: iso,
        lat: body.lat,
        lng: body.lng,
        distanceKm,
        alertCount: newAlertCount,
      });

      // 1단계(1회 이탈)만 참여자 본인에게 웹푸시 — 2·3단계는 관리자 콘솔 "이탈 현황" 화면에서 확인
      if (newAlertCount === 1) {
        const subscriptions = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.participantId, participant.id));

        for (const subscription of subscriptions) {
          const result = await sendWebPush(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            {
              title: "⚠️ 이탈 경고",
              body: `${demandSite.name} 활동 구역을 벗어났습니다.`,
            },
            {
              privateJWK: c.env.VAPID_PRIVATE_KEY,
              subject: c.env.VAPID_SUBJECT,
            },
          );
          if (!result.ok && result.expired) {
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
          }
        }
      }
    }

    await saveMeta({
      alertCount: newAlertCount,
      outsideStart: meta?.outsideStart ?? iso,
    });

    return c.json({
      ok: true,
      escaped: true,
      distanceKm,
      alertCount: newAlertCount,
      demandSiteName: demandSite.name,
    });
  }

  // 반경 안으로 복귀 — alertCount는 유지하고(관리자가 RESOLVED해야 초기화) 진행 중이던 이탈만 종료
  await saveMeta({ alertCount: currentAlertCount, outsideStart: null });

  return c.json({
    ok: true,
    escaped: false,
    distanceKm,
    demandSiteName: demandSite.name,
  });
});

type ActivityLogBody = {
  participantId?: number;
  actDate?: string;
  startTime?: string;
  endTime?: string;
  content?: string;
  place?: string;
  hasAccident?: boolean;
  accidentDetail?: string;
  accidentAction?: string;
  userSignature?: string;
  demandSignature?: string;
};

// 활동일지 등록 — IndexedDB에 먼저 저장된 뒤(오프라인 대응) 온라인일 때 여기로 동기화된다.
// 참여자 식별은 /attendance/identify와 동일한 이름+전화번호 흐름에서 얻은 participantId를 그대로 쓴다.
app.post("/activity-logs", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<ActivityLogBody>();

  if (
    !body.participantId ||
    !body.actDate ||
    !body.startTime ||
    !body.endTime
  ) {
    return c.json(
      { error: "participantId, actDate, startTime, endTime are required" },
      400,
    );
  }

  const participant = await db
    .select()
    .from(participants)
    .where(eq(participants.id, body.participantId));
  if (!participant[0]) {
    return c.json({ error: "일치하는 참여자를 찾을 수 없습니다." }, 404);
  }

  const result = await db
    .insert(activityLogs)
    .values({
      participantId: body.participantId,
      actDate: body.actDate,
      startTime: body.startTime,
      endTime: body.endTime,
      content: body.content,
      place: body.place,
      hasAccident: body.hasAccident ?? false,
      accidentDetail: body.accidentDetail,
      accidentAction: body.accidentAction,
      userSignature: body.userSignature,
      demandSignature: body.demandSignature,
    })
    .returning();

  return c.json(result[0], 201);
});

// 활동일지 수정 — 작성 도중(일시→내용→사고→서명) 단계마다 "저장하기"를 누르는 기존 흐름이라,
// 한 번 동기화된 뒤에도 이후 단계에서 채워진 내용이 서버에 반영되도록 등록과 별개로 둔다.
app.put("/activity-logs/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const body = await c.req.json<ActivityLogBody>();

  if (
    !body.participantId ||
    !body.actDate ||
    !body.startTime ||
    !body.endTime
  ) {
    return c.json(
      { error: "participantId, actDate, startTime, endTime are required" },
      400,
    );
  }

  const result = await db
    .update(activityLogs)
    .set({
      actDate: body.actDate,
      startTime: body.startTime,
      endTime: body.endTime,
      content: body.content,
      place: body.place,
      hasAccident: body.hasAccident ?? false,
      accidentDetail: body.accidentDetail,
      accidentAction: body.accidentAction,
      userSignature: body.userSignature,
      demandSignature: body.demandSignature,
    })
    .where(
      and(
        eq(activityLogs.id, id),
        eq(activityLogs.participantId, body.participantId),
      ),
    )
    .returning();

  if (!result[0]) return c.json({ error: "Not found" }, 404);
  return c.json(result[0]);
});

// 활동일지 조회 — 기기를 바꾸거나 IndexedDB가 지워졌을 때 복구용
app.get("/activity-logs", async (c) => {
  const db = drizzle(c.env.DB);
  const participantId = c.req.query("participantId");
  const month = c.req.query("month"); // "YYYY-MM"

  if (!participantId || !month) {
    return c.json({ error: "participantId, month are required" }, 400);
  }

  const rows = await db
    .select()
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.participantId, Number(participantId)),
        like(activityLogs.actDate, `${month}%`),
      ),
    );

  return c.json(rows);
});

export default app;
