import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sign } from "hono/jwt";

import { admins } from "../db/schema";
import { verifyPassword } from "../lib/password";
import type { Env } from "../types";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7일

const app = new Hono<Env>();

app.post("/", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ username?: string; password?: string }>();

  if (!body.username || !body.password) {
    return c.json({ error: "username and password are required" }, 400);
  }

  const rows = await db
    .select()
    .from(admins)
    .where(eq(admins.username, body.username));

  const admin = rows[0];
  if (!admin || !(await verifyPassword(body.password, admin.passwordHash))) {
    return c.json({ error: "invalid credentials" }, 401);
  }

  const token = await sign(
    {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      organizationId: admin.organizationId,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    },
    c.env.JWT_SECRET,
  );

  return c.json({ token });
});

export default app;
