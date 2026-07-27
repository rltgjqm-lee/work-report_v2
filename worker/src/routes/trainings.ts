import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";

import {
  projectTrainings,
  participantTrainingLogs,
  participants,
  programs,
} from "../db/schema";
import { canAccessProgram, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

const loadAccessibleProgram = async (
  db: ReturnType<typeof drizzle>,
  auth: ReturnType<typeof getAuth>,
  programId: number,
) => {
  const rows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = rows[0];
  if (!program) return null;
  if (!canAccessProgram(auth, program)) return null;
  return program;
};

const computePayAmount = (
  training: typeof projectTrainings.$inferSelect,
  attendHours: number,
  program: typeof programs.$inferSelect,
): number => {
  if (training.payMode === "HOURLY") {
    return Math.round(attendHours * program.hourlyWage);
  }
  if (training.payMode === "DAILY") {
    return training.dailyWage ?? 0;
  }
  return 0; // WORK(근무시간 합산에 반영, 별도 지급 없음) / NONE
};

// ── 교육 정의 ──

app.get("/", async (c) => {
  const auth = getAuth(c);
  const programId = Number(c.req.query("programId"));
  if (!programId) return c.json({ error: "사업단을 지정해주세요." }, 400);

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const rows = await db
    .select()
    .from(projectTrainings)
    .where(eq(projectTrainings.programId, programId));

  return c.json(rows);
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  const body = await c.req.json<{
    programId?: number;
    name?: string;
    category?: "PRE" | "DURING";
    isPaid?: boolean;
    payMode?: "WORK" | "HOURLY" | "DAILY" | "NONE";
    hours?: number;
    dailyWage?: number;
    isRequired?: boolean;
  }>();

  if (!body.programId || !body.name || !body.category) {
    return c.json(
      { error: "사업단, 교육명, 교육 구분을 모두 입력해주세요." },
      400,
    );
  }

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, body.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const result = await db
    .insert(projectTrainings)
    .values({
      programId: body.programId,
      name: body.name,
      category: body.category,
      isPaid: body.isPaid ?? false,
      payMode: body.payMode ?? "NONE",
      hours: body.hours,
      dailyWage: body.dailyWage,
      isRequired: body.isRequired ?? false,
    })
    .returning();

  return c.json(result[0], 201);
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const existingRows = await db
    .select()
    .from(projectTrainings)
    .where(eq(projectTrainings.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "교육 정보를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, existing.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const body = await c.req.json<{
    name?: string;
    category?: "PRE" | "DURING";
    isPaid?: boolean;
    payMode?: "WORK" | "HOURLY" | "DAILY" | "NONE";
    hours?: number;
    dailyWage?: number;
    isRequired?: boolean;
    isActive?: boolean;
  }>();

  const result = await db
    .update(projectTrainings)
    .set({
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      isPaid: body.isPaid ?? existing.isPaid,
      payMode: body.payMode ?? existing.payMode,
      hours: body.hours ?? existing.hours,
      dailyWage: body.dailyWage ?? existing.dailyWage,
      isRequired: body.isRequired ?? existing.isRequired,
      isActive: body.isActive ?? existing.isActive,
    })
    .where(eq(projectTrainings.id, id))
    .returning();

  return c.json(result[0]);
});

// ── 이수 현황 ──

app.get("/logs", async (c) => {
  const auth = getAuth(c);
  const programId = Number(c.req.query("programId"));
  if (!programId) return c.json({ error: "사업단을 지정해주세요." }, 400);

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const trainingId = c.req.query("trainingId");
  const conditions = [eq(participants.programId, programId)];
  if (trainingId) {
    conditions.push(eq(participantTrainingLogs.trainingId, Number(trainingId)));
  }

  const rows = await db
    .select({
      log: participantTrainingLogs,
      participantName: participants.name,
      trainingName: projectTrainings.name,
    })
    .from(participantTrainingLogs)
    .innerJoin(
      participants,
      eq(participantTrainingLogs.participantId, participants.id),
    )
    .innerJoin(
      projectTrainings,
      eq(participantTrainingLogs.trainingId, projectTrainings.id),
    )
    .where(and(...conditions));

  return c.json(rows);
});

app.post("/logs", async (c) => {
  const auth = getAuth(c);
  const body = await c.req.json<{
    participantId?: number;
    trainingId?: number;
    attendDate?: string;
    attendHours?: number;
  }>();

  if (!body.participantId || !body.trainingId || !body.attendDate) {
    return c.json({ error: "참여자, 교육, 참석일을 모두 지정해주세요." }, 400);
  }

  const db = drizzle(c.env.DB);

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, body.participantId));
  const participant = participantRows[0];
  if (!participant) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);

  const trainingRows = await db
    .select()
    .from(projectTrainings)
    .where(eq(projectTrainings.id, body.trainingId));
  const training = trainingRows[0];
  if (!training) return c.json({ error: "교육을 찾을 수 없습니다." }, 404);

  if (training.programId !== participant.programId) {
    return c.json({ error: "참여자와 교육이 같은 사업단이어야 합니다." }, 400);
  }

  const program = await loadAccessibleProgram(db, auth, participant.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const attendHours = body.attendHours ?? training.hours ?? 0;
  const payAmount = computePayAmount(training, attendHours, program);

  const result = await db
    .insert(participantTrainingLogs)
    .values({
      participantId: body.participantId,
      trainingId: body.trainingId,
      attendDate: body.attendDate,
      attendHours,
      payAmount,
    })
    .returning();

  return c.json(result[0], 201);
});

app.put("/logs/:id", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const existingRows = await db
    .select()
    .from(participantTrainingLogs)
    .where(eq(participantTrainingLogs.id, id));
  const existing = existingRows[0];
  if (!existing)
    return c.json({ error: "교육 참석 기록을 찾을 수 없습니다." }, 404);

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, existing.participantId));
  const participant = participantRows[0];
  if (!participant) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, participant.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const trainingRows = await db
    .select()
    .from(projectTrainings)
    .where(eq(projectTrainings.id, existing.trainingId));
  const training = trainingRows[0];
  if (!training) return c.json({ error: "교육 정보를 찾을 수 없습니다." }, 404);

  const body = await c.req.json<{
    attendDate?: string;
    attendHours?: number;
  }>();

  const attendHours = body.attendHours ?? existing.attendHours;
  const payAmount = computePayAmount(training, attendHours, program);

  const result = await db
    .update(participantTrainingLogs)
    .set({
      attendDate: body.attendDate ?? existing.attendDate,
      attendHours,
      payAmount,
    })
    .where(eq(participantTrainingLogs.id, id))
    .returning();

  return c.json(result[0]);
});

// 이수 취소 — 하드 삭제 대신 status=CANCELLED로 소프트 처리
app.delete("/logs/:id", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const existingRows = await db
    .select()
    .from(participantTrainingLogs)
    .where(eq(participantTrainingLogs.id, id));
  const existing = existingRows[0];
  if (!existing)
    return c.json({ error: "교육 참석 기록을 찾을 수 없습니다." }, 404);

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, existing.participantId));
  const participant = participantRows[0];
  if (!participant) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, participant.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const result = await db
    .update(participantTrainingLogs)
    .set({ status: "CANCELLED" })
    .where(eq(participantTrainingLogs.id, id))
    .returning();

  return c.json(result[0]);
});

// ── 필수교육 현황 (미이수자 요약) ──

app.get("/summary", async (c) => {
  const auth = getAuth(c);
  const programId = Number(c.req.query("programId"));
  if (!programId) return c.json({ error: "사업단을 지정해주세요." }, 400);

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const [activeParticipants, requiredTrainings, logs] = await Promise.all([
    db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.programId, programId),
          eq(participants.status, "ACTIVE"),
        ),
      ),
    db
      .select()
      .from(projectTrainings)
      .where(
        and(
          eq(projectTrainings.programId, programId),
          eq(projectTrainings.isRequired, true),
          eq(projectTrainings.isActive, true),
        ),
      ),
    db
      .select({
        participantId: participantTrainingLogs.participantId,
        trainingId: participantTrainingLogs.trainingId,
      })
      .from(participantTrainingLogs)
      .innerJoin(
        participants,
        eq(participantTrainingLogs.participantId, participants.id),
      )
      .where(
        and(
          eq(participants.programId, programId),
          eq(participantTrainingLogs.status, "COMPLETED"),
        ),
      ),
  ]);

  const completedKeySet = new Set(
    logs.map((log) => `${log.participantId}:${log.trainingId}`),
  );

  const summary = activeParticipants
    .map((participant) => {
      const missingTrainings = requiredTrainings.filter(
        (training) => !completedKeySet.has(`${participant.id}:${training.id}`),
      );
      return {
        participantId: participant.id,
        participantName: participant.name,
        missingTrainings: missingTrainings.map((training) => ({
          id: training.id,
          name: training.name,
        })),
      };
    })
    .filter((row) => row.missingTrainings.length > 0);

  return c.json(summary);
});

export default app;
