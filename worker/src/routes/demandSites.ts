import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, getTableColumns } from "drizzle-orm";
import proj4 from "proj4";

import {
  admins,
  demandSites,
  demandSiteLocations,
  demandSiteSchedules,
  programs,
  groups,
} from "../db/schema";
import { canAccessProgram, getAuth, parseIdArray } from "../lib/authz";
import { ROLES, type Env } from "../types";

const app = new Hono<Env>();

// GPS 오차를 감안한 원형 거점 최소 반경 — 클라이언트에서도 강제하지만 API 직접 호출 대비 서버에서도 보장
const MIN_RADIUS_METERS = 1500;

type DemandSiteBody = {
  programId?: number;
  name?: string;
  address?: string;
  contactAdminId?: number | null;
  // 수요처 단위 기본 관제구역 — 셋 다 있어야 원이 성립한다
  baseLat?: number | null;
  baseLng?: number | null;
  radius?: number | null;
  isActive?: boolean;
};

// 주소 → 좌표(대략치). 브라우저에서 바로 부르면 CORS에 걸려서 서버에서 대신 조회한다.
// OpenStreetMap Nominatim은 API 키가 없는 대신 앱을 식별하는 User-Agent를 요구한다.
// 국내 주소는 도로 단위까지만 잡히는 경우가 많아 최소 반경으로 오차를 흡수한다 —
// 거점 편집 지도의 "주소로 찾기"(지도를 대충 그 근처로 옮기는 용도)에서만 쓰고,
// 실제 관제구역 중심(baseLat/baseLng)은 아래 resolveDemandSiteCoordinate로 더 정확하게 잡는다.
const geocodeAddressApprox = async (address: string) => {
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
    return null;
  }
};

// juso.go.kr 좌표제공 API는 좌표를 EPSG:5179(중부원점, GRS80 TM)로 내려준다 — Leaflet
// 지도와 DB(baseLat/baseLng)는 WGS84 위경도 기준이라 proj4로 직접 변환해야 한다.
const EPSG_5179 =
  "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs";

type JusoRoadAddressIdentifier = {
  admCd: string;
  rnMgtSn: string;
  udrtYn: string;
  buldMnnm: string;
  buldSlno: string;
};

// juso.go.kr 좌표제공 API(addrCoordApi.do)는 주소 문자열이 아니라 이 식별자들을 받는다.
const fetchJusoCoordinate = async (identifier: JusoRoadAddressIdentifier, jusoApiKey: string) => {
  const url = new URL("https://www.juso.go.kr/addrlink/addrCoordApi.do");
  url.searchParams.set("confmKey", jusoApiKey);
  url.searchParams.set("resultType", "json");
  url.searchParams.set("admCd", identifier.admCd);
  url.searchParams.set("rnMgtSn", identifier.rnMgtSn);
  url.searchParams.set("udrtYn", identifier.udrtYn);
  url.searchParams.set("buldMnnm", identifier.buldMnnm);
  url.searchParams.set("buldSlno", identifier.buldSlno);

  const response = await fetch(url);
  if (!response.ok) {
    console.error("fetchJusoCoordinate: HTTP 오류", response.status);
    return null;
  }

  const body = (await response.json()) as {
    results: {
      common: { errorCode: string; errorMessage: string };
      juso: { entX: string; entY: string }[] | null;
    };
  };
  if (body.results.common.errorCode !== "0" || !body.results.juso?.length) {
    console.error("fetchJusoCoordinate: juso.go.kr 응답 오류/매칭 없음", {
      identifier,
      common: body.results.common,
    });
    return null;
  }

  const coordinate = body.results.juso[0];
  const x = Number(coordinate.entX);
  const y = Number(coordinate.entY);
  if (!x || !y) {
    console.error("fetchJusoCoordinate: 좌표 값이 비정상", coordinate);
    return null;
  }

  const [lng, lat] = proj4(EPSG_5179, "WGS84", [x, y]);
  return { lat, lng };
};

// 도로명주소 검색 API(addrLinkApi.do)로 juso.go.kr 자체 식별자를 받는다 — 좌표제공
// API(addrCoordApi.do)와 승인키가 서로 다르다(신청 단위로 키가 따로 나온다).
const findRoadAddressIdentifier = async (
  address: string,
  jusoSearchApiKey: string,
): Promise<JusoRoadAddressIdentifier | null> => {
  try {
    const url = new URL("https://www.juso.go.kr/addrlink/addrLinkApi.do");
    url.searchParams.set("confmKey", jusoSearchApiKey);
    url.searchParams.set("currentPage", "1");
    url.searchParams.set("countPerPage", "1");
    url.searchParams.set("keyword", address);
    url.searchParams.set("resultType", "json");

    const response = await fetch(url);
    if (!response.ok) return null;

    const body = (await response.json()) as {
      results: {
        common: { errorCode: string; errorMessage: string };
        juso: JusoRoadAddressIdentifier[] | null;
      };
    };
    if (body.results.common.errorCode !== "0" || !body.results.juso?.length) {
      console.error("findRoadAddressIdentifier: 검색 API 응답 오류", body.results.common);
      return null;
    }

    return body.results.juso[0];
  } catch (error) {
    console.error("findRoadAddressIdentifier: 예외 발생", error);
    return null;
  }
};

// 주소 → 관제구역 중심 좌표. 검색 API로 도로명주소 식별자를 찾고, 그 식별자로
// 좌표제공 API를 호출해 EPSG:5179 좌표를 받아 WGS84로 변환한다. 실패로 수요처 저장
// 자체가 막히면 안 되므로 못 찾으면 null — 관리자는 거점 관리에서 구역을 직접 그리면 된다.
const resolveDemandSiteCoordinate = async (
  address: string,
  { coordApiKey, searchApiKey }: { coordApiKey: string; searchApiKey: string },
) => {
  const identifier = await findRoadAddressIdentifier(address, searchApiKey);
  if (!identifier) return null;

  return fetchJusoCoordinate(identifier, coordApiKey);
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
  polygon: row.polygon ? (JSON.parse(row.polygon) as { lat: number; lng: number }[]) : null,
});

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

// 사업단 담당자 = 그 사업단을 담당(programIds)하는 MANAGER 계정. 수요처를 새로 만들 때
// 담당자를 따로 고르지 않고 이 사람을 그대로 물려받는다. 사업단 담당자는 한 명이므로 첫 건만 쓴다.
const findProgramManagerId = async (
  db: ReturnType<typeof drizzle>,
  program: typeof programs.$inferSelect,
) => {
  const candidates = await db
    .select({ id: admins.id, programIds: admins.programIds })
    .from(admins)
    .where(
      and(
        eq(admins.organizationId, program.organizationId),
        eq(admins.role, ROLES.MANAGER),
        eq(admins.isActive, true),
      ),
    );

  const manager = candidates.find((candidate) =>
    parseIdArray(candidate.programIds).includes(program.id),
  );

  return manager?.id ?? null;
};

// 주소 → 대략적인 좌표 조회. Nominatim이 CORS 헤더를 안 내려줘서 브라우저에서 직접
// 못 부른다 — 거점 편집 지도의 "주소로 찾기"(지도를 그 근처로 옮기는 용도)가 이
// 경로로 우회한다. 정확한 좌표가 필요한 관제구역 중심은 POST/PUT에서 따로 잡는다.
app.get("/geocode", async (c) => {
  const address = c.req.query("address");
  if (!address) return c.json({ error: "주소를 입력해주세요." }, 400);

  const point = await geocodeAddressApprox(address);
  if (!point) return c.json({ error: "주소를 찾을 수 없습니다." }, 404);

  return c.json(point);
});

app.get("/", async (c) => {
  const auth = getAuth(c);
  const programId = Number(c.req.query("programId"));
  if (!programId) return c.json({ error: "사업단을 지정해주세요." }, 400);

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  // 담당자 이름은 계정 쪽에 있으니 조인해서 같이 내려준다. 계정 연결 이전에 자유 입력으로
  // 쌓인 contactPerson은 표시할 이름이 없을 때의 대체값으로 남는다.
  const rows = await db
    .select({
      ...getTableColumns(demandSites),
      contactAdminName: admins.name,
    })
    .from(demandSites)
    .leftJoin(admins, eq(demandSites.contactAdminId, admins.id))
    .where(eq(demandSites.programId, programId));

  return c.json(rows);
});

// 수요처 담당자로 지정할 수 있는 계정 목록. 계정 관리 화면(GET /api/admins)은 부관리자/
// 담당자에게 막혀 있어서, 수요처를 다룰 수 있는 사람이면 누구나 쓸 수 있게 id/이름만 내려준다.
app.get("/assignable-admins", async (c) => {
  const auth = getAuth(c);
  const programId = Number(c.req.query("programId"));
  if (!programId) return c.json({ error: "사업단을 지정해주세요." }, 400);

  const db = drizzle(c.env.DB);
  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const rows = await db
    .select({ id: admins.id, name: admins.name })
    .from(admins)
    .where(
      and(
        eq(admins.organizationId, program.organizationId),
        eq(admins.role, ROLES.MANAGER),
        eq(admins.isActive, true),
      ),
    );

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
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  // 좌표를 직접 보내지 않았으면 주소로 잡아준다
  const point =
    body.baseLat == null && body.baseLng == null && body.address
      ? await resolveDemandSiteCoordinate(body.address, {
          coordApiKey: c.env.JUSO_API_KEY,
          searchApiKey: c.env.JUSO_SEARCH_API_KEY,
        })
      : null;

  const result = await db
    .insert(demandSites)
    .values({
      programId: body.programId,
      name: body.name,
      address: body.address,
      contactAdminId: body.contactAdminId ?? (await findProgramManagerId(db, program)),
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

  const existingRows = await db.select().from(demandSites).where(eq(demandSites.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, existing.programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const body = await c.req.json<DemandSiteBody>();

  const address = body.address ?? existing.address;
  // 관제 중심은 주소를 따라간다 — 주소가 바뀌었거나 아직 좌표가 없으면 다시 잡고,
  // 주소를 지웠으면 관제구역도 함께 해제한다.
  const shouldGeocode =
    body.baseLat == null &&
    body.baseLng == null &&
    !!address &&
    (address !== existing.address || existing.baseLat === null);
  const point = shouldGeocode
    ? await resolveDemandSiteCoordinate(address, {
        coordApiKey: c.env.JUSO_API_KEY,
        searchApiKey: c.env.JUSO_SEARCH_API_KEY,
      })
    : null;

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
      // 담당자는 명시적으로 null을 보내 비울 수 있어야 해서 undefined만 걸러낸다
      contactAdminId:
        body.contactAdminId === undefined ? existing.contactAdminId : body.contactAdminId,
      ...normalizeBaseArea(nextBaseArea.baseLat, nextBaseArea.baseLng, nextBaseArea.radius),
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

  const siteRows = await db.select().from(demandSites).where(eq(demandSites.id, id));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

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

  const siteRows = await db.select().from(demandSites).where(eq(demandSites.id, id));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const body = await c.req.json<LocationBody>();
  if (!body.name || !body.shapeType) {
    return c.json({ error: "구역 이름과 구역 형태를 입력해주세요." }, 400);
  }
  if (
    body.shapeType === "RADIUS" &&
    (body.baseLat === undefined || body.baseLng === undefined || body.radius === undefined)
  ) {
    return c.json({ error: "RADIUS 거점은 baseLat, baseLng, radius가 필요합니다." }, 400);
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
      radius: body.shapeType === "RADIUS" ? Math.max(body.radius!, MIN_RADIUS_METERS) : null,
      polygon: body.shapeType === "POLYGON" ? JSON.stringify(body.polygon) : null,
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
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const body = await c.req.json<LocationBody>();
  const shapeType = body.shapeType ?? location.shapeType;

  const result = await db
    .update(demandSiteLocations)
    .set({
      name: body.name ?? location.name,
      shapeType,
      baseLat: shapeType === "RADIUS" ? (body.baseLat ?? location.baseLat) : null,
      baseLng: shapeType === "RADIUS" ? (body.baseLng ?? location.baseLng) : null,
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
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  await db.delete(demandSiteLocations).where(eq(demandSiteLocations.id, locationId));

  return c.json({ success: true });
});

app.get("/:id/schedules", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);

  const siteRows = await db.select().from(demandSites).where(eq(demandSites.id, id));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

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

  const siteRows = await db.select().from(demandSites).where(eq(demandSites.id, id));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const body = await c.req.json<ScheduleBody>();
  if (!body.groupId || !body.shiftStart || !body.shiftEnd) {
    return c.json({ error: "조와 근무 시작 시간, 종료 시간을 모두 지정해주세요." }, 400);
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
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

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
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  await db.delete(demandSiteSchedules).where(eq(demandSiteSchedules.id, scheduleId));

  return c.json({ success: true });
});

export default app;
