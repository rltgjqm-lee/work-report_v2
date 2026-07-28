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
  // 수요처 단위 기본 관제구역 — 셋 다 있어야 원이 성립한다
  baseLat?: number | null;
  baseLng?: number | null;
  radius?: number | null;
  isActive?: boolean;
};

// 주소 → 좌표. 브라우저에서 바로 부르면 CORS에 걸려서 서버에서 대신 조회한다.
// OpenStreetMap Nominatim은 API 키가 없는 대신 앱을 식별하는 User-Agent를 요구한다.
// 국내 주소는 도로 단위까지만 잡히는 경우가 많아 최소 반경으로 오차를 흡수한다.
const geocodeAddress = async (address: string) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": "work-report-admin/1.0" } },
    );
    if (!response.ok) return null;

    const results = (await response.json()) as { lat: string; lon: string }[];
    if (results.length === 0) return null;

    return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
  } catch {
    // 지오코딩 실패로 수요처 저장 자체가 막히면 안 된다 — 좌표 없이 저장하고,
    // 관리자는 거점 관리에서 구역을 직접 그리면 된다.
    return null;
  }
};

// 수요처 기본 관제구역도 거점과 같은 최소 반경 규칙을 따른다.
// 셋 중 하나라도 비면 관제구역 없음(null)으로 정리한다.
const normalizeBaseArea = (
  baseLat: number | null | undefined,
  baseLng: number | null | undefined,
  radius: number | null | undefined,
) => {
  if (
    baseLat === null ||
    baseLat === undefined ||
    baseLng === null ||
    baseLng === undefined ||
    radius === null ||
    radius === undefined
  ) {
    return { baseLat: null, baseLng: null, radius: null };
  }

  return {
    baseLat,
    baseLng,
    radius: Math.max(Math.round(radius), MIN_RADIUS_METERS),
  };
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

// 주소 → 좌표 조회. Nominatim이 CORS 헤더를 안 내려줘서 브라우저에서 직접 못 부른다 —
// 거점 편집 지도의 "주소로 찾기"가 이 경로로 우회한다.
app.get("/geocode", async (c) => {
  const address = c.req.query("address");
  if (!address) return c.json({ error: "주소를 입력해주세요." }, 400);

  const point = await geocodeAddress(address);
  if (!point) return c.json({ error: "주소를 찾을 수 없습니다." }, 404);

  return c.json(point);
});

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

  // 좌표를 직접 보내지 않았으면 주소로 잡아준다
  const point =
    body.baseLat == null && body.baseLng == null && body.address
      ? await geocodeAddress(body.address)
      : null;

  const result = await db
    .insert(demandSites)
    .values({
      programId: body.programId,
      name: body.name,
      address: body.address,
      contactPerson: body.contactPerson,
      ...normalizeBaseArea(
        point ? point.lat : body.baseLat,
        point ? point.lng : body.baseLng,
        body.radius,
      ),
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

  const address = body.address ?? existing.address;
  // 관제 중심은 주소를 따라간다 — 주소가 바뀌었거나 아직 좌표가 없으면 다시 잡고,
  // 주소를 지웠으면 관제구역도 함께 해제한다.
  const shouldGeocode =
    body.baseLat == null &&
    body.baseLng == null &&
    !!address &&
    (address !== existing.address || existing.baseLat === null);
  const point = shouldGeocode ? await geocodeAddress(address) : null;

  const nextBaseArea = !address
    ? { baseLat: null, baseLng: null, radius: null }
    : {
        baseLat: point ? point.lat : (body.baseLat ?? existing.baseLat),
        baseLng: point ? point.lng : (body.baseLng ?? existing.baseLng),
        radius: body.radius === undefined ? existing.radius : body.radius,
      };

  const result = await db
    .update(demandSites)
    .set({
      name: body.name ?? existing.name,
      address,
      contactPerson: body.contactPerson ?? existing.contactPerson,
      ...normalizeBaseArea(
        nextBaseArea.baseLat,
        nextBaseArea.baseLng,
        nextBaseArea.radius,
      ),
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
