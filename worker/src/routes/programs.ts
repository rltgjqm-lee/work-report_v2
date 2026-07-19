import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray, like } from "drizzle-orm";

import {
  programs,
  participants,
  participantLeaves,
  groups,
  attendanceLogs,
  activityLogs,
  pushSubscriptions,
  pendingPushes,
  disasterPushLogs,
} from "../db/schema";
import { canAccessProgram, getAuth, hasMinRole } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

type ProgramBody = {
  organizationId?: number;
  name?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  programType?: string;
  hourlyWage?: number;
  educationAmount?: number;
  educationType?: "add" | "deduct";
  dementiaAmount?: number;
  dementiaType?: "add" | "deduct";
  healthInsuranceRate?: number;
  longtermCareRate?: number;
  employmentInsuranceRate?: number;
  industrialAccidentRate?: number;
  annualLeaveDailyWage?: number;
};

app.get("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const queryOrgId = c.req.query("organizationId");

  const organizationId =
    auth.role === "SUPER_ADMIN"
      ? queryOrgId
        ? Number(queryOrgId)
        : undefined
      : (auth.organizationId as number);

  const rows = organizationId
    ? await db
        .select()
        .from(programs)
        .where(eq(programs.organizationId, organizationId))
    : await db.select().from(programs);

  const visible =
    auth.role === "MANAGER"
      ? rows.filter((p) => auth.programIds.includes(p.id))
      : rows;

  return c.json(visible);
});

app.get("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, id));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.programId, id));

  return c.json({ ...program, participants: participantRows });
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const body = await c.req.json<ProgramBody>();

  if (!hasMinRole(auth, "AGENCY_ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const organizationId =
    auth.role === "SUPER_ADMIN"
      ? body.organizationId
      : (auth.organizationId as number);
  const { name, startDate, endDate, startTime, endTime } = body;
  if (
    !organizationId ||
    !name ||
    !startDate ||
    !endDate ||
    !startTime ||
    !endTime
  ) {
    return c.json(
      {
        error:
          "organizationId, name, startDate, endDate, startTime, endTime are required",
      },
      400,
    );
  }

  const result = await db
    .insert(programs)
    .values({
      organizationId,
      name,
      startDate,
      endDate,
      startTime,
      endTime,
      programType: body.programType,
      hourlyWage: body.hourlyWage,
      educationAmount: body.educationAmount,
      educationType: body.educationType,
      dementiaAmount: body.dementiaAmount,
      dementiaType: body.dementiaType,
      healthInsuranceRate: body.healthInsuranceRate,
      longtermCareRate: body.longtermCareRate,
      employmentInsuranceRate: body.employmentInsuranceRate,
      industrialAccidentRate: body.industrialAccidentRate,
      annualLeaveDailyWage: body.annualLeaveDailyWage,
    })
    .returning();

  return c.json(result[0], 201);
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const existingRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "Not found" }, 404);
  // 사업단 수정은 SUB_ADMIN까지 허용 (등록/삭제는 AGENCY_ADMIN 이상)
  if (!hasMinRole(auth, "SUB_ADMIN") || !canAccessProgram(auth, existing)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<ProgramBody>();

  const result = await db
    .update(programs)
    .set(body)
    .where(eq(programs.id, id))
    .returning();

  return c.json(result[0]);
});

app.delete("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const existingRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (!hasMinRole(auth, "AGENCY_ADMIN") || !canAccessProgram(auth, existing)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // 💡 참여자/사업단을 참조하는 자식 테이블을 FK 순서대로 먼저 지워야 programs 삭제가
  // FOREIGN KEY constraint failed 없이 성공한다
  const participantRows = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.programId, id));
  const participantIds = participantRows.map((participant) => participant.id);

  if (participantIds.length > 0) {
    await db
      .delete(activityLogs)
      .where(inArray(activityLogs.participantId, participantIds));
    await db
      .delete(participantLeaves)
      .where(inArray(participantLeaves.participantId, participantIds));
  }

  await db.delete(attendanceLogs).where(eq(attendanceLogs.programId, id));
  await db.delete(participants).where(eq(participants.programId, id));
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.programId, id));
  await db.delete(pendingPushes).where(eq(pendingPushes.programId, id));
  await db.delete(disasterPushLogs).where(eq(disasterPushLogs.programId, id));
  await db.delete(groups).where(eq(groups.programId, id));
  await db.delete(programs).where(eq(programs.id, id));

  return c.json({ success: true });
});

app.get("/:id/groups", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select()
    .from(groups)
    .where(eq(groups.programId, programId));
  return c.json(rows);
});

app.post("/:id/groups", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    description?: string;
    shiftStart?: string;
    shiftEnd?: string;
  }>();

  if (!body.name || !body.shiftStart || !body.shiftEnd) {
    return c.json({ error: "name, shiftStart, shiftEnd are required" }, 400);
  }

  const result = await db
    .insert(groups)
    .values({
      programId,
      name: body.name,
      description: body.description,
      shiftStart: body.shiftStart,
      shiftEnd: body.shiftEnd,
    })
    .returning();

  return c.json(result[0], 201);
});

app.get("/:id/participants", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select()
    .from(participants)
    .where(eq(participants.programId, programId));

  return c.json(rows);
});

app.post("/:id/participants", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    demandName?: string;
    phoneLast4?: string;
    groupId?: number;
    birthYear?: number;
  }>();

  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }
  if (!body.phoneLast4 || !/^\d{4}$/.test(body.phoneLast4)) {
    return c.json({ error: "phoneLast4 must be 4 digits" }, 400);
  }

  const result = await db
    .insert(participants)
    .values({
      programId,
      name: body.name,
      demandName: body.demandName,
      phoneLast4: body.phoneLast4,
      groupId: body.groupId,
      birthYear: body.birthYear,
    })
    .returning();

  return c.json(result[0], 201);
});

app.post("/:id/participants/bulk", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    participants?: {
      name?: string;
      demandName?: string;
      phoneLast4?: string;
      groupId?: number;
      birthYear?: number;
    }[];
  }>();

  const rows = body.participants ?? [];
  if (rows.length === 0) {
    return c.json({ error: "participants must be a non-empty array" }, 400);
  }

  const errors: { index: number; error: string }[] = [];
  rows.forEach((row, index) => {
    if (!row.name) {
      errors.push({ index, error: "name is required" });
    } else if (!row.phoneLast4 || !/^\d{4}$/.test(row.phoneLast4)) {
      errors.push({ index, error: "phoneLast4 must be 4 digits" });
    }
  });

  if (errors.length > 0) {
    return c.json({ error: "validation failed", details: errors }, 400);
  }

  const result = await db
    .insert(participants)
    .values(
      rows.map((row) => ({
        programId,
        name: row.name!,
        demandName: row.demandName,
        phoneLast4: row.phoneLast4!,
        groupId: row.groupId,
        birthYear: row.birthYear,
      })),
    )
    .returning();

  return c.json(result, 201);
});

app.delete("/:id/participants/:participantId", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const participantId = Number(c.req.param("participantId"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // 💡 참여자를 참조하는 자식 테이블을 먼저 지워야 FOREIGN KEY constraint failed 없이
  // 삭제가 성공한다 (사업단 삭제 라우트와 동일한 이유)
  await db
    .delete(activityLogs)
    .where(eq(activityLogs.participantId, participantId));
  await db
    .delete(participantLeaves)
    .where(eq(participantLeaves.participantId, participantId));
  await db
    .delete(attendanceLogs)
    .where(eq(attendanceLogs.participantId, participantId));

  const result = await db
    .delete(participants)
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.programId, programId),
      ),
    )
    .returning();

  if (!result[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

app.get("/:id/attendance", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month"); // "YYYY-MM"

  if (!month) return c.json({ error: "month is required" }, 400);

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select({
      log: attendanceLogs,
      participantName: participants.name,
      groupName: groups.name,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
    })
    .from(attendanceLogs)
    .innerJoin(participants, eq(attendanceLogs.participantId, participants.id))
    .leftJoin(groups, eq(attendanceLogs.groupId, groups.id))
    .where(
      and(
        eq(attendanceLogs.programId, programId),
        like(attendanceLogs.workDate, `${month}%`),
      ),
    );

  return c.json(rows);
});

export default app;
