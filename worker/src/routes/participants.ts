import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, sql } from "drizzle-orm";

import {
  participants,
  programs,
  participantLeaves,
  participantAnnualLeave,
  participantMonthlySchedule,
  groups,
  demandSites,
} from "../db/schema";
import { canAccessProgram, getAuth } from "../lib/authz";
import { getKstNow } from "../lib/kst";
import type { Env } from "../types";

const toLeaveDays = (leaveStart: string, leaveEnd: string): number => {
  const start = new Date(`${leaveStart}T00:00:00Z`).getTime();
  const end = new Date(`${leaveEnd}T00:00:00Z`).getTime();
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
};

const app = new Hono<Env>();

const loadParticipantWithProgram = async (
  db: ReturnType<typeof drizzle>,
  participantId: number,
) => {
  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));
  const participant = participantRows[0];
  if (!participant) return null;

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, participant.programId));
  const program = programRows[0];
  if (!program) return null;

  return { participant, program };
};

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    demandName?: string;
    demandSiteId?: number;
    phoneLast4?: string;
    birthYear?: number;
    groupId?: number;
  }>();

  if (body.demandSiteId) {
    const demandSiteRows = await db
      .select()
      .from(demandSites)
      .where(eq(demandSites.id, body.demandSiteId));
    if (demandSiteRows[0]?.programId !== found.participant.programId) {
      return c.json({ error: "해당 사업단의 수요처가 아닙니다." }, 400);
    }
  }

  const result = await db
    .update(participants)
    .set(body)
    .where(eq(participants.id, id))
    .returning();

  return c.json(result[0]);
});

// 개별 참여자 조 이동
app.post("/:id/group", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ groupId?: number }>();
  if (!body.groupId) return c.json({ error: "groupId is required" }, 400);

  const groupRows = await db
    .select()
    .from(groups)
    .where(eq(groups.id, body.groupId));
  const group = groupRows[0];
  if (!group || group.programId !== found.participant.programId) {
    return c.json({ error: "해당 사업단의 조가 아닙니다." }, 400);
  }

  const result = await db
    .update(participants)
    .set({ groupId: body.groupId })
    .where(eq(participants.id, id))
    .returning();

  return c.json(result[0]);
});

app.post("/:id/drop", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ dropReason?: string }>();

  const result = await db
    .update(participants)
    .set({
      status: "DROPPED",
      droppedAt: new Date().toISOString(),
      dropReason: body.dropReason,
    })
    .where(eq(participants.id, id))
    .returning();

  return c.json(result[0]);
});

app.post("/:id/leave", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    leaveStart?: string;
    leaveEnd?: string;
    leaveType?: "PAID" | "UNPAID";
    reason?: string;
  }>();

  if (!body.leaveStart || !body.leaveEnd) {
    return c.json({ error: "leaveStart, leaveEnd are required" }, 400);
  }

  const leaveType = body.leaveType ?? "PAID";
  const leaveDays = toLeaveDays(body.leaveStart, body.leaveEnd);
  const year = getKstNow().date.slice(0, 4);

  if (leaveType === "PAID") {
    const annualRows = await db
      .select()
      .from(participantAnnualLeave)
      .where(
        and(
          eq(participantAnnualLeave.participantId, id),
          eq(participantAnnualLeave.year, year),
        ),
      );
    const remainingDays = annualRows[0]?.remainingDays ?? 0;
    if (remainingDays < leaveDays) {
      return c.json(
        {
          error: `잔여 연차가 부족합니다. (잔여 ${remainingDays}일, 신청 ${leaveDays}일)`,
        },
        400,
      );
    }
  }

  const result = await db
    .update(participants)
    .set({
      status: "ON_LEAVE",
      leaveStart: body.leaveStart,
      leaveEnd: body.leaveEnd,
    })
    .where(eq(participants.id, id))
    .returning();

  await db.insert(participantLeaves).values({
    participantId: id,
    leaveStart: body.leaveStart,
    leaveEnd: body.leaveEnd,
    leaveType,
    leaveDays,
    reason: body.reason,
    createdBy: auth.id,
  });

  if (leaveType === "PAID") {
    await db
      .update(participantAnnualLeave)
      .set({
        usedDays: sql`${participantAnnualLeave.usedDays} + ${leaveDays}`,
        remainingDays: sql`${participantAnnualLeave.remainingDays} - ${leaveDays}`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(participantAnnualLeave.participantId, id),
          eq(participantAnnualLeave.year, year),
        ),
      );
  }

  return c.json(result[0]);
});

app.post("/:id/leave/end", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await db
    .update(participants)
    .set({
      status: "ACTIVE",
      leaveStart: null,
      leaveEnd: null,
    })
    .where(eq(participants.id, id))
    .returning();

  return c.json(result[0]);
});

// 탈락 처리된 참여자를 다시 ACTIVE로 되돌린다
app.post("/:id/reactivate", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (found.participant.status !== "DROPPED") {
    return c.json(
      { error: "탈락 상태인 참여자만 재활성화할 수 있습니다." },
      400,
    );
  }

  const result = await db
    .update(participants)
    .set({
      status: "ACTIVE",
      droppedAt: null,
      dropReason: null,
    })
    .where(eq(participants.id, id))
    .returning();

  return c.json(result[0]);
});

app.get("/:id/annual-leave", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const year = c.req.query("year") ?? getKstNow().date.slice(0, 4);

  const rows = await db
    .select()
    .from(participantAnnualLeave)
    .where(
      and(
        eq(participantAnnualLeave.participantId, id),
        eq(participantAnnualLeave.year, year),
      ),
    );

  return c.json(
    rows[0] ?? {
      participantId: id,
      year,
      totalDays: 0,
      usedDays: 0,
      remainingDays: 0,
    },
  );
});

app.post("/:id/annual-leave", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ year?: string; totalDays?: number }>();
  if (!body.year || body.totalDays === undefined) {
    return c.json({ error: "year, totalDays are required" }, 400);
  }

  const existingRows = await db
    .select()
    .from(participantAnnualLeave)
    .where(
      and(
        eq(participantAnnualLeave.participantId, id),
        eq(participantAnnualLeave.year, body.year),
      ),
    );
  const existing = existingRows[0];

  if (existing) {
    const result = await db
      .update(participantAnnualLeave)
      .set({
        totalDays: body.totalDays,
        remainingDays: body.totalDays - existing.usedDays,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(participantAnnualLeave.id, existing.id))
      .returning();
    return c.json(result[0]);
  }

  const result = await db
    .insert(participantAnnualLeave)
    .values({
      participantId: id,
      year: body.year,
      totalDays: body.totalDays,
      usedDays: 0,
      remainingDays: body.totalDays,
    })
    .returning();

  return c.json(result[0], 201);
});

// 참여자 개인 예외 스케줄 조회 — 레코드가 없으면 조 스케줄을 그대로 따른다는 뜻으로
// workDates: null을 내려준다 (조 기본값은 groups.ts의 :id/monthly-schedule에서 따로 조회)
app.get("/:id/monthly-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const yearMonth = c.req.query("month");
  if (!yearMonth) return c.json({ error: "month is required" }, 400);

  const rows = await db
    .select()
    .from(participantMonthlySchedule)
    .where(
      and(
        eq(participantMonthlySchedule.participantId, id),
        eq(participantMonthlySchedule.yearMonth, yearMonth),
      ),
    );
  const schedule = rows[0];

  return c.json({
    participantId: id,
    yearMonth,
    workDates: schedule ? (JSON.parse(schedule.workDates) as string[]) : null,
    maxMonthlyMinutes: schedule?.maxMonthlyMinutes ?? null,
  });
});

app.put("/:id/monthly-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    yearMonth?: string;
    workDates?: string[];
    maxMonthlyMinutes?: number | null;
  }>();
  if (!body.yearMonth || !body.workDates) {
    return c.json({ error: "yearMonth, workDates are required" }, 400);
  }

  const existingRows = await db
    .select()
    .from(participantMonthlySchedule)
    .where(
      and(
        eq(participantMonthlySchedule.participantId, id),
        eq(participantMonthlySchedule.yearMonth, body.yearMonth),
      ),
    );
  const existing = existingRows[0];
  const workDatesJson = JSON.stringify(body.workDates);
  const maxMonthlyMinutes = body.maxMonthlyMinutes ?? null;

  if (existing) {
    await db
      .update(participantMonthlySchedule)
      .set({ workDates: workDatesJson, maxMonthlyMinutes })
      .where(eq(participantMonthlySchedule.id, existing.id));
    return c.json({
      participantId: id,
      yearMonth: body.yearMonth,
      workDates: body.workDates,
      maxMonthlyMinutes,
    });
  }

  await db.insert(participantMonthlySchedule).values({
    participantId: id,
    yearMonth: body.yearMonth,
    workDates: workDatesJson,
    maxMonthlyMinutes,
  });

  return c.json(
    {
      participantId: id,
      yearMonth: body.yearMonth,
      workDates: body.workDates,
      maxMonthlyMinutes,
    },
    201,
  );
});

// 개인 예외 삭제 — 다시 조 스케줄을 그대로 따르게 한다
app.delete("/:id/monthly-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const yearMonth = c.req.query("month");
  if (!yearMonth) return c.json({ error: "month is required" }, 400);

  await db
    .delete(participantMonthlySchedule)
    .where(
      and(
        eq(participantMonthlySchedule.participantId, id),
        eq(participantMonthlySchedule.yearMonth, yearMonth),
      ),
    );

  return c.json({ success: true });
});

export default app;
