import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { programs, participants } from "../db/schema";
import { canAccessOrg, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

app.get("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const queryOrgId = c.req.query("organizationId");

  const organizationId =
    auth.role === "super_admin"
      ? queryOrgId
        ? Number(queryOrgId)
        : undefined
      : (auth.organizationId as number);

  const rows = organizationId
    ? await db.select().from(programs).where(eq(programs.organizationId, organizationId))
    : await db.select().from(programs);

  return c.json(rows);
});

app.get("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const programRows = await db.select().from(programs).where(eq(programs.id, id));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessOrg(auth, program.organizationId)) {
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
  const body = await c.req.json<{
    organizationId?: number;
    name?: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
  }>();

  const organizationId =
    auth.role === "super_admin" ? body.organizationId : (auth.organizationId as number);
  const { name, startDate, endDate, startTime, endTime } = body;
  if (!organizationId || !name || !startDate || !endDate || !startTime || !endTime) {
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
    .values({ organizationId, name, startDate, endDate, startTime, endTime })
    .returning();

  return c.json(result[0], 201);
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const existingRows = await db.select().from(programs).where(eq(programs.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (!canAccessOrg(auth, existing.organizationId)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
  }>();

  const result = await db
    .update(programs)
    .set(body)
    .where(eq(programs.id, id))
    .returning();

  return c.json(result[0]);
});

app.get("/:id/participants", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessOrg(auth, program.organizationId)) {
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

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessOrg(auth, program.organizationId)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ name?: string; demandName?: string }>();
  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }

  const result = await db
    .insert(participants)
    .values({ programId, name: body.name, demandName: body.demandName })
    .returning();

  return c.json(result[0], 201);
});

export default app;
