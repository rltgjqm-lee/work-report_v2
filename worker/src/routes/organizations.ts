import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { organizations, programs } from "../db/schema";
import { canAccessOrg, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

type OrganizationBody = {
  name?: string;
  address?: string;
  rep?: string;
  phone?: string;
  fax?: string;
  bizNo?: string;
  regionSido?: string;
  regionSigungu?: string;
  organizationType?: string;
  prjYear?: string;
};

app.get("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);

  if (auth.role === "SUPER_ADMIN") {
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
  if (auth.role !== "SUPER_ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const db = drizzle(c.env.DB);
  const body = await c.req.json<OrganizationBody>();

  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }

  const result = await db
    .insert(organizations)
    .values({
      name: body.name,
      address: body.address,
      rep: body.rep,
      phone: body.phone,
      fax: body.fax,
      bizNo: body.bizNo,
      regionSido: body.regionSido,
      regionSigungu: body.regionSigungu,
      organizationType: body.organizationType,
      prjYear: body.prjYear,
    })
    .returning();

  return c.json(result[0], 201);
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));

  if (!canAccessOrg(auth, id)) return c.json({ error: "Forbidden" }, 403);

  const db = drizzle(c.env.DB);
  const body = await c.req.json<OrganizationBody>();

  const result = await db
    .update(organizations)
    .set(body)
    .where(eq(organizations.id, id))
    .returning();

  if (!result[0]) return c.json({ error: "Not found" }, 404);
  return c.json(result[0]);
});

app.delete("/:id", async (c) => {
  const auth = getAuth(c);
  if (auth.role !== "SUPER_ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const dependentPrograms = await db
    .select()
    .from(programs)
    .where(eq(programs.organizationId, id));

  if (dependentPrograms.length > 0) {
    return c.json({ error: "소속 사업단이 있어 삭제할 수 없습니다" }, 400);
  }

  const result = await db
    .delete(organizations)
    .where(eq(organizations.id, id))
    .returning();

  if (!result[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

export default app;
