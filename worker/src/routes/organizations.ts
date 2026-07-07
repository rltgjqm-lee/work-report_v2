import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { organizations } from "../db/schema";
import { canAccessOrg, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

app.get("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);

  if (auth.role === "super_admin") {
    return c.json(await db.select().from(organizations));
  }

  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, auth.organizationId as number));
  return c.json(rows);
});

app.get("/:id", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));

  if (!canAccessOrg(auth, id)) return c.json({ error: "Forbidden" }, 403);

  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id));

  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  if (auth.role !== "super_admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ name?: string }>();

  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }

  const result = await db
    .insert(organizations)
    .values({ name: body.name })
    .returning();

  return c.json(result[0], 201);
});

export default app;
