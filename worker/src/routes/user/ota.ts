import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { otaBundles } from "../../db/schema";
import { isNewerVersion } from "../../lib/semver";
import type { Env } from "../../types";

const app = new Hono<Env>();

// Capacitor 하이브리드 앱이 부팅할 때마다 호출 — 활성 번들이 현재 버전보다 최신이면
// 다운로드 URL/체크섬을 돌려주고, 아니면 업데이트 없음을 알린다.
app.get("/latest", async (c) => {
  const currentVersion = c.req.query("currentVersion") || "0.0.0";

  const db = drizzle(c.env.DB);
  const rows = await db.select().from(otaBundles).where(eq(otaBundles.isActive, true));
  const active = rows[0];

  if (!active || !isNewerVersion(active.version, currentVersion)) {
    return c.json({ version: null });
  }

  return c.json({
    version: active.version,
    checksum: active.checksum,
    url: `/public/ota/bundles/${active.id}/download`,
  });
});

// 플러그인이 이 URL을 직접 다운로드하므로 base64가 아니라 zip 바이트를 그대로 스트리밍한다.
app.get("/bundles/:id/download", async (c) => {
  const id = Number(c.req.param("id"));

  const db = drizzle(c.env.DB);
  const rows = await db.select().from(otaBundles).where(eq(otaBundles.id, id));
  const bundle = rows[0];
  if (!bundle) return c.json({ error: "번들을 찾을 수 없습니다." }, 404);

  const object = await c.env.OTA_BUNDLES_BUCKET.get(bundle.r2Key);
  if (!object) return c.json({ error: "번들 파일을 찾을 수 없습니다." }, 404);

  return new Response(object.body, {
    headers: { "Content-Type": "application/zip" },
  });
});

export default app;
