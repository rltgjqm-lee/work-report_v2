import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";

import { groups, programs, participants } from "../db/schema";
import { canAccessGroup, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

const loadGroupWithProgram = async (db: ReturnType<typeof drizzle>, groupId: number) => {
  const groupRows = await db.select().from(groups).where(eq(groups.id, groupId));
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

  const result = await db
    .update(groups)
    .set(body)
    .where(eq(groups.id, id))
    .returning();

  return c.json(result[0]);
});

app.delete("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessGroup(auth, found.group, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const memberCount = await db
    .select()
    .from(participants)
    .where(eq(participants.groupId, id));

  if (memberCount.length > 0) {
    return c.json(
      { error: `해당 조에 ${memberCount.length}명이 배정되어 있어 삭제할 수 없습니다.` },
      400,
    );
  }

  const result = await db.delete(groups).where(eq(groups.id, id)).returning();
  if (!result[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
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
