import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import {
  demandSites,
  demandSiteSchedules,
  programs,
  groups,
} from "../db/schema";
import { canAccessProgram, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

type DemandSiteBody = {
  programId?: number;
  name?: string;
  baseLat?: number;
  baseLng?: number;
  allowedRadius?: number;
  address?: string;
  contactPerson?: string;
  isActive?: boolean;
};

type ScheduleBody = {
  groupId?: number;
  shiftStart?: string;
  shiftEnd?: string;
};

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

app.get("/", async (c) => {
  const auth = getAuth(c);
  const programId = Number(c.req.query("programId"));
  if (!programId) return c.json({ error: "programId is required" }, 400);

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program) return c.json({ error: "Forbidden" }, 403);

  const rows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.programId, programId));

  return c.json(rows);
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  const body = await c.req.json<DemandSiteBody>();

  if (
    !body.programId ||
    !body.name ||
    body.baseLat === undefined ||
    body.baseLng === undefined
  ) {
    return c.json(
      { error: "programId, name, baseLat, baseLng are required" },
      400,
    );
  }

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, body.programId);
  if (!program) return c.json({ error: "Forbidden" }, 403);

  const result = await db
    .insert(demandSites)
    .values({
      programId: body.programId,
      name: body.name,
      baseLat: body.baseLat,
      baseLng: body.baseLng,
      allowedRadius: body.allowedRadius,
      address: body.address,
      contactPerson: body.contactPerson,
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
    .from(demandSites)
    .where(eq(demandSites.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "Not found" }, 404);

  const program = await loadAccessibleProgram(db, auth, existing.programId);
  if (!program) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<DemandSiteBody>();

  const result = await db
    .update(demandSites)
    .set({
      name: body.name ?? existing.name,
      baseLat: body.baseLat ?? existing.baseLat,
      baseLng: body.baseLng ?? existing.baseLng,
      allowedRadius: body.allowedRadius ?? existing.allowedRadius,
      address: body.address ?? existing.address,
      contactPerson: body.contactPerson ?? existing.contactPerson,
      isActive: body.isActive ?? existing.isActive,
    })
    .where(eq(demandSites.id, id))
    .returning();

  return c.json(result[0]);
});

app.get("/:id/schedules", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, id));
  const site = siteRows[0];
  if (!site) return c.json({ error: "Not found" }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program) return c.json({ error: "Forbidden" }, 403);

  const rows = await db
    .select({
      id: demandSiteSchedules.id,
      demandSiteId: demandSiteSchedules.demandSiteId,
      groupId: demandSiteSchedules.groupId,
      groupName: groups.name,
      shiftStart: demandSiteSchedules.shiftStart,
      shiftEnd: demandSiteSchedules.shiftEnd,
    })
    .from(demandSiteSchedules)
    .innerJoin(groups, eq(demandSiteSchedules.groupId, groups.id))
    .where(eq(demandSiteSchedules.demandSiteId, id));

  return c.json(rows);
});

app.post("/:id/schedules", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, id));
  const site = siteRows[0];
  if (!site) return c.json({ error: "Not found" }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<ScheduleBody>();
  if (!body.groupId || !body.shiftStart || !body.shiftEnd) {
    return c.json({ error: "groupId, shiftStart, shiftEnd are required" }, 400);
  }

  const result = await db
    .insert(demandSiteSchedules)
    .values({
      demandSiteId: id,
      groupId: body.groupId,
      shiftStart: body.shiftStart,
      shiftEnd: body.shiftEnd,
    })
    .returning();

  return c.json(result[0], 201);
});

app.put("/schedules/:scheduleId", async (c) => {
  const auth = getAuth(c);
  const scheduleId = Number(c.req.param("scheduleId"));
  const db = drizzle(c.env.DB);

  const scheduleRows = await db
    .select()
    .from(demandSiteSchedules)
    .where(eq(demandSiteSchedules.id, scheduleId));
  const schedule = scheduleRows[0];
  if (!schedule) return c.json({ error: "Not found" }, 404);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, schedule.demandSiteId));
  const site = siteRows[0];
  if (!site) return c.json({ error: "Not found" }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<ScheduleBody>();

  const result = await db
    .update(demandSiteSchedules)
    .set({
      shiftStart: body.shiftStart ?? schedule.shiftStart,
      shiftEnd: body.shiftEnd ?? schedule.shiftEnd,
    })
    .where(eq(demandSiteSchedules.id, scheduleId))
    .returning();

  return c.json(result[0]);
});

app.delete("/schedules/:scheduleId", async (c) => {
  const auth = getAuth(c);
  const scheduleId = Number(c.req.param("scheduleId"));
  const db = drizzle(c.env.DB);

  const scheduleRows = await db
    .select()
    .from(demandSiteSchedules)
    .where(eq(demandSiteSchedules.id, scheduleId));
  const schedule = scheduleRows[0];
  if (!schedule) return c.json({ error: "Not found" }, 404);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, schedule.demandSiteId));
  const site = siteRows[0];
  if (!site) return c.json({ error: "Not found" }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program) return c.json({ error: "Forbidden" }, 403);

  await db
    .delete(demandSiteSchedules)
    .where(eq(demandSiteSchedules.id, scheduleId));

  return c.json({ success: true });
});

export default app;
