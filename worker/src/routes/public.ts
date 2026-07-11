import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { organizations, programs, pushSubscriptions } from "../db/schema";
import type { Env } from "../types";

const app = new Hono<Env>();

app.get("/organizations", async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations);

  return c.json(rows);
});

app.get("/programs", async (c) => {
  const db = drizzle(c.env.DB);
  const organizationId = c.req.query("organizationId");

  const query = db
    .select({
      id: programs.id,
      name: programs.name,
      organizationId: programs.organizationId,
      startDate: programs.startDate,
      endDate: programs.endDate,
      startTime: programs.startTime,
      endTime: programs.endTime,
    })
    .from(programs);

  const rows = organizationId
    ? await query.where(eq(programs.organizationId, Number(organizationId)))
    : await query;

  return c.json(rows);
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

export default app;
