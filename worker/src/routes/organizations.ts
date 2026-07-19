import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { organizations } from "../db/schema";
import { canAccessOrg, getAuth, hasMinRole } from "../lib/authz";
import { ROLES, type Env } from "../types";

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
  isActive?: boolean;
};

app.get("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);

  if (auth.role === ROLES.SUPER_ADMIN) {
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
  if (auth.role !== ROLES.SUPER_ADMIN) {
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

  // 기관 정보 수정은 ORGANIZATION_ADMIN 이상만 가능 (SUB_ADMIN/MANAGER는 조회만)
  if (!hasMinRole(auth, ROLES.ORGANIZATION_ADMIN) || !canAccessOrg(auth, id)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const db = drizzle(c.env.DB);
  const body = await c.req.json<OrganizationBody>();

  // 활성/비활성 전환(소프트 삭제)은 SUPER_ADMIN만 — 나머지 필드 수정과는 별개 권한
  if (body.isActive !== undefined && auth.role !== ROLES.SUPER_ADMIN) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await db
    .update(organizations)
    .set(body)
    .where(eq(organizations.id, id))
    .returning();

  if (!result[0]) return c.json({ error: "Not found" }, 404);
  return c.json(result[0]);
});

export default app;
