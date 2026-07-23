import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray } from "drizzle-orm";

import {
  groups,
  programs,
  participants,
  groupMonthlySchedule,
} from "../db/schema";
import { canAccessGroup, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

const loadGroupWithProgram = async (
  db: ReturnType<typeof drizzle>,
  groupId: number,
) => {
  const groupRows = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId));
  const group = groupRows[0];
  if (!group) return null;

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, group.programId));
  const program = programRows[0];
  if (!program) return null;

  return { group, program };
};

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessGroup(auth, found.group, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    description?: string;
    shiftStart?: string;
    shiftEnd?: string;
    isActive?: boolean;
  }>();

  // 비활성화(소프트 삭제)는 활성 참여자가 배정돼 있으면 먼저 다른 조로 옮기게 막는다
  if (body.isActive === false) {
    const members = await db
      .select()
      .from(participants)
      .where(
        and(eq(participants.groupId, id), eq(participants.status, "ACTIVE")),
      );

    if (members.length > 0) {
      return c.json(
        {
          error: `해당 조에 ${members.length}명이 배정되어 있어 비활성화할 수 없습니다.`,
        },
        400,
      );
    }
  }

  const result = await db
    .update(groups)
    .set(body)
    .where(eq(groups.id, id))
    .returning();

  return c.json(result[0]);
});

// 역량활동 월간 근무 스케줄(조 기본값) 조회 — 참여자 개인 예외는 participants.ts 참고
app.get("/:id/monthly-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessGroup(auth, found.group, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const yearMonth = c.req.query("month");
  if (!yearMonth) return c.json({ error: "month is required" }, 400);

  const rows = await db
    .select()
    .from(groupMonthlySchedule)
    .where(
      and(
        eq(groupMonthlySchedule.groupId, id),
        eq(groupMonthlySchedule.yearMonth, yearMonth),
      ),
    );
  const schedule = rows[0];

  return c.json({
    groupId: id,
    yearMonth,
    workDates: schedule ? (JSON.parse(schedule.workDates) as string[]) : [],
    maxMonthlyMinutes: schedule?.maxMonthlyMinutes ?? 1800,
  });
});

app.put("/:id/monthly-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessGroup(auth, found.group, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    yearMonth?: string;
    workDates?: string[];
    maxMonthlyMinutes?: number;
  }>();
  if (!body.yearMonth || !body.workDates) {
    return c.json({ error: "yearMonth, workDates are required" }, 400);
  }

  const existingRows = await db
    .select()
    .from(groupMonthlySchedule)
    .where(
      and(
        eq(groupMonthlySchedule.groupId, id),
        eq(groupMonthlySchedule.yearMonth, body.yearMonth),
      ),
    );
  const existing = existingRows[0];
  const workDatesJson = JSON.stringify(body.workDates);
  const maxMonthlyMinutes = body.maxMonthlyMinutes ?? 1800;

  if (existing) {
    await db
      .update(groupMonthlySchedule)
      .set({ workDates: workDatesJson, maxMonthlyMinutes })
      .where(eq(groupMonthlySchedule.id, existing.id));
    return c.json({
      groupId: id,
      yearMonth: body.yearMonth,
      workDates: body.workDates,
      maxMonthlyMinutes,
    });
  }

  await db.insert(groupMonthlySchedule).values({
    groupId: id,
    yearMonth: body.yearMonth,
    workDates: workDatesJson,
    maxMonthlyMinutes,
  });

  return c.json(
    {
      groupId: id,
      yearMonth: body.yearMonth,
      workDates: body.workDates,
      maxMonthlyMinutes,
    },
    201,
  );
});

// 참여자 일괄 조 이동
app.post("/bulk-assign", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);

  const body = await c.req.json<{
    participantIds?: number[];
    groupId?: number;
  }>();

  if (!body.participantIds?.length || !body.groupId) {
    return c.json({ error: "participantIds, groupId are required" }, 400);
  }

  const found = await loadGroupWithProgram(db, body.groupId);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessGroup(auth, found.group, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await db
    .update(participants)
    .set({ groupId: body.groupId })
    .where(inArray(participants.id, body.participantIds))
    .returning();

  return c.json({ updated: result.length });
});

export default app;
