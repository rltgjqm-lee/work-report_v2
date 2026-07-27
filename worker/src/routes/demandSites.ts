import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import {
  demandSites,
  demandSiteLocations,
  demandSiteSchedules,
  programs,
  groups,
} from "../db/schema";
import { canAccessProgram, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

// GPS 오차를 감안한 원형 거점 최소 반경 — 클라이언트에서도 강제하지만 API 직접 호출 대비 서버에서도 보장
const MIN_RADIUS_METERS = 1500;

type DemandSiteBody = {
  programId?: number;
  name?: string;
  address?: string;
  contactPerson?: string;
  isActive?: boolean;
};

type ScheduleBody = {
  groupId?: number;
  shiftStart?: string;
  shiftEnd?: string;
};

type LocationBody = {
  name?: string;
  shapeType?: "RADIUS" | "POLYGON";
  baseLat?: number;
  baseLng?: number;
  radius?: number;
  polygon?: { lat: number; lng: number }[];
};

const serializeLocation = (row: typeof demandSiteLocations.$inferSelect) => ({
  ...row,
  polygon: row.polygon
    ? (JSON.parse(row.polygon) as { lat: number; lng: number }[])
    : null,
});

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
  if (!programId) return c.json({ error: "사업단을 지정해주세요." }, 400);

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const rows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.programId, programId));

  return c.json(rows);
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  const body = await c.req.json<DemandSiteBody>();

  if (!body.programId || !body.name) {
    return c.json({ error: "사업단과 수요처명을 입력해주세요." }, 400);
  }

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, body.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const result = await db
    .insert(demandSites)
    .values({
      programId: body.programId,
      name: body.name,
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
  if (!existing) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, existing.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const body = await c.req.json<DemandSiteBody>();

  const result = await db
    .update(demandSites)
    .set({
      name: body.name ?? existing.name,
      address: body.address ?? existing.address,
      contactPerson: body.contactPerson ?? existing.contactPerson,
      isActive: body.isActive ?? existing.isActive,
    })
    .where(eq(demandSites.id, id))
    .returning();

  return c.json(result[0]);
});

// ── 수요처 하위 거점(원형/다각형) ──

app.get("/:id/locations", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, id));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const rows = await db
    .select()
    .from(demandSiteLocations)
    .where(eq(demandSiteLocations.demandSiteId, id));

  return c.json(rows.map(serializeLocation));
});

app.post("/:id/locations", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, id));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const body = await c.req.json<LocationBody>();
  if (!body.name || !body.shapeType) {
    return c.json({ error: "구역 이름과 구역 형태를 입력해주세요." }, 400);
  }
  if (
    body.shapeType === "RADIUS" &&
    (body.baseLat === undefined ||
      body.baseLng === undefined ||
      body.radius === undefined)
  ) {
    return c.json(
      { error: "RADIUS 거점은 baseLat, baseLng, radius가 필요합니다." },
      400,
    );
  }
  if (body.shapeType === "POLYGON" && (body.polygon?.length ?? 0) < 3) {
    return c.json({ error: "POLYGON 거점은 좌표가 3개 이상 필요합니다." }, 400);
  }

  const result = await db
    .insert(demandSiteLocations)
    .values({
      demandSiteId: id,
      name: body.name,
      shapeType: body.shapeType,
      baseLat: body.shapeType === "RADIUS" ? body.baseLat : null,
      baseLng: body.shapeType === "RADIUS" ? body.baseLng : null,
      radius:
        body.shapeType === "RADIUS"
          ? Math.max(body.radius!, MIN_RADIUS_METERS)
          : null,
      polygon:
        body.shapeType === "POLYGON" ? JSON.stringify(body.polygon) : null,
    })
    .returning();

  return c.json(serializeLocation(result[0]), 201);
});

app.put("/locations/:locationId", async (c) => {
  const auth = getAuth(c);
  const locationId = Number(c.req.param("locationId"));
  const db = drizzle(c.env.DB);

  const locationRows = await db
    .select()
    .from(demandSiteLocations)
    .where(eq(demandSiteLocations.id, locationId));
  const location = locationRows[0];
  if (!location) return c.json({ error: "위치 정보를 찾을 수 없습니다." }, 404);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, location.demandSiteId));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const body = await c.req.json<LocationBody>();
  const shapeType = body.shapeType ?? location.shapeType;

  const result = await db
    .update(demandSiteLocations)
    .set({
      name: body.name ?? location.name,
      shapeType,
      baseLat:
        shapeType === "RADIUS" ? (body.baseLat ?? location.baseLat) : null,
      baseLng:
        shapeType === "RADIUS" ? (body.baseLng ?? location.baseLng) : null,
      radius:
        shapeType === "RADIUS"
          ? Math.max(body.radius ?? location.radius ?? 0, MIN_RADIUS_METERS)
          : null,
      polygon:
        shapeType === "POLYGON"
          ? JSON.stringify(body.polygon ?? JSON.parse(location.polygon ?? "[]"))
          : null,
    })
    .where(eq(demandSiteLocations.id, locationId))
    .returning();

  return c.json(serializeLocation(result[0]));
});

app.delete("/locations/:locationId", async (c) => {
  const auth = getAuth(c);
  const locationId = Number(c.req.param("locationId"));
  const db = drizzle(c.env.DB);

  const locationRows = await db
    .select()
    .from(demandSiteLocations)
    .where(eq(demandSiteLocations.id, locationId));
  const location = locationRows[0];
  if (!location) return c.json({ error: "위치 정보를 찾을 수 없습니다." }, 404);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, location.demandSiteId));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  await db
    .delete(demandSiteLocations)
    .where(eq(demandSiteLocations.id, locationId));

  return c.json({ success: true });
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
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

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
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const body = await c.req.json<ScheduleBody>();
  if (!body.groupId || !body.shiftStart || !body.shiftEnd) {
    return c.json(
      { error: "조와 근무 시작 시간, 종료 시간을 모두 지정해주세요." },
      400,
    );
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
  if (!schedule) return c.json({ error: "근무 일정을 찾을 수 없습니다." }, 404);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, schedule.demandSiteId));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

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
  if (!schedule) return c.json({ error: "근무 일정을 찾을 수 없습니다." }, 404);

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, schedule.demandSiteId));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program)
    return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  await db
    .delete(demandSiteSchedules)
    .where(eq(demandSiteSchedules.id, scheduleId));

  return c.json({ success: true });
});

export default app;
