import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import type { Env } from "../../types";

import { programActivityOptions, programs } from "../../db/schema";
import { canAccessProgram, getAuth } from "../../lib/authz";

const app = new Hono<Env>();

const loadAccessibleProgram = async (
  db: ReturnType<typeof drizzle>,
  auth: ReturnType<typeof getAuth>,
  programId: number,
) => {
  const rows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = rows[0];
  if (!program) return null;
  if (!canAccessProgram(auth, program)) return null;
  return program;
};

app.get("/", async (c) => {
  const auth = getAuth(c);
  const programId = Number(c.req.query("programId"));
  if (!programId) return c.json({ error: "사업단을 지정해주세요." }, 400);

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const rows = await db
    .select()
    .from(programActivityOptions)
    .where(eq(programActivityOptions.programId, programId));

  return c.json(rows);
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  const body = await c.req.json<{
    programId?: number;
    category?: "CONTENT" | "PLACE";
    label?: string;
  }>();

  if (!body.programId || !body.category || !body.label?.trim()) {
    return c.json({ error: "사업단, 구분, 항목명을 모두 입력해주세요." }, 400);
  }

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, body.programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  try {
    const result = await db
      .insert(programActivityOptions)
      .values({ programId: body.programId, category: body.category, label: body.label.trim() })
      .returning();

    return c.json(result[0], 201);
  } catch {
    // program_activity_options_program_category_label_unique 위반
    return c.json({ error: "이미 등록된 항목입니다." }, 409);
  }
});

app.delete("/:id", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const rows = await db
    .select()
    .from(programActivityOptions)
    .where(eq(programActivityOptions.id, id));
  const option = rows[0];
  if (!option) return c.json({ error: "항목을 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, option.programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  await db.delete(programActivityOptions).where(eq(programActivityOptions.id, id));

  return c.json({ success: true });
});

export default app;
