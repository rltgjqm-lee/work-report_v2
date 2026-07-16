import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { participants, programs, participantLeaves, groups } from "../db/schema";
import { canAccessProgram, getAuth } from "../lib/authz";
import type { Env } from "../types";

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
    phoneLast4?: string;
    birthYear?: number;
    groupId?: number;
  }>();

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

  const groupRows = await db.select().from(groups).where(eq(groups.id, body.groupId));
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
    reason?: string;
  }>();

  if (!body.leaveStart || !body.leaveEnd) {
    return c.json({ error: "leaveStart, leaveEnd are required" }, 400);
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
    reason: body.reason,
    createdBy: auth.id,
  });

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

export default app;
