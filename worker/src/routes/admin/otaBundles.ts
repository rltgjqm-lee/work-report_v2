import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq } from "drizzle-orm";

import { otaBundles } from "../../db/schema";
import { getAuth } from "../../lib/authz";
import { ROLES, type Env } from "../../types";

const app = new Hono<Env>();

const toBundleJson = (bundle: typeof otaBundles.$inferSelect) => ({
  id: bundle.id,
  version: bundle.version,
  checksum: bundle.checksum,
  fileSize: bundle.fileSize,
  isActive: bundle.isActive,
  createdAt: bundle.createdAt,
});

const arrayBufferToHex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

// OTA 배포는 참여자 전원에게 즉시 영향을 주는 앱 전역 작업이라 기관 소속 관리자가 아니라
// SUPER_ADMIN만 다룬다(사업단/기관 단위 권한 매트릭스와 별개).
app.get("/", async (c) => {
  const auth = getAuth(c);
  if (auth.role !== ROLES.SUPER_ADMIN) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const db = drizzle(c.env.DB);
  const rows = await db.select().from(otaBundles).orderBy(desc(otaBundles.createdAt));
  return c.json(rows.map(toBundleJson));
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  if (auth.role !== ROLES.SUPER_ADMIN) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const version = c.req.query("version");
  if (!version) {
    return c.json({ error: "버전을 지정해주세요." }, 400);
  }

  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) {
    return c.json({ error: "번들 파일이 비어있습니다." }, 400);
  }

  const db = drizzle(c.env.DB);

  const duplicateRows = await db
    .select({ id: otaBundles.id })
    .from(otaBundles)
    .where(eq(otaBundles.version, version));
  if (duplicateRows[0]) {
    return c.json({ error: "이미 등록된 버전입니다." }, 409);
  }

  const checksumBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = arrayBufferToHex(checksumBuffer);
  const r2Key = `ota/${version}.zip`;

  await c.env.OTA_BUNDLES_BUCKET.put(r2Key, bytes, {
    httpMetadata: { contentType: "application/zip" },
  });

  const result = await db
    .insert(otaBundles)
    .values({
      version,
      r2Key,
      checksum,
      fileSize: bytes.byteLength,
    })
    .returning();

  return c.json(toBundleJson(result[0]), 201);
});

// 롤백도 이 엔드포인트를 그대로 쓴다 — 이전 버전 id로 다시 activate하면 됨.
app.post("/:id/activate", async (c) => {
  const auth = getAuth(c);
  if (auth.role !== ROLES.SUPER_ADMIN) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const rows = await db.select().from(otaBundles).where(eq(otaBundles.id, id));
  const target = rows[0];
  if (!target) return c.json({ error: "번들을 찾을 수 없습니다." }, 404);

  // 활성 row는 항상 하나 이하로 유지 — 전체 비활성화 후 대상만 활성화를 한 트랜잭션(batch)으로.
  await db.batch([
    db.update(otaBundles).set({ isActive: false }).where(eq(otaBundles.isActive, true)),
    db.update(otaBundles).set({ isActive: true }).where(eq(otaBundles.id, id)),
  ]);

  return c.json({ ok: true, version: target.version });
});

export default app;
