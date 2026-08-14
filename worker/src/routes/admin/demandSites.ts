import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import proj4 from "proj4";

import { ROLES, type Env } from "../../types";

import {
  admins,
  demandSiteLocations,
  demandSites,
  demandSiteSchedules,
  groups,
  programs,
} from "../../db/schema";
import { canAccessProgram, getAuth, parseIdArray } from "../../lib/authz";

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
  // false면 좌표/반경이 있어도 관제 판정에서 뺀다(다각형 거점만 쓰고 싶은 경우)
  baseAreaEnabled?: boolean;
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
    radius: Math.round(radius),
  };
};

type ScheduleBody = {
  groupId?: number;
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

// 사업단 담당자 = 그 사업단을 담당(programIds)하는 MANAGER 또는 SUB_ADMIN 계정. 수요처를
// 새로 만들 때 담당자를 따로 고르지 않고 이 사람을 그대로 물려받는다. 사업단 담당자는
// 한 명이므로 첫 건만 쓴다.
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
        inArray(admins.role, [ROLES.MANAGER, ROLES.SUB_ADMIN]),
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

  // program은 위에서 접근 권한 체크하려고 이미 조회해둔 것이라, breadcrumb용 이름을
  // 추가 쿼리 없이 같이 내려준다 — EscapesPage/AttendancePage가 이 라우트 하나로
  // 사업단명 + 수요처 목록을 둘 다 받게 하기 위함.
  return c.json({ programName: program.name, demandSites: rows });
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
        inArray(admins.role, [ROLES.MANAGER, ROLES.SUB_ADMIN]),
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

  const duplicateRows = await db
    .select({ id: demandSites.id })
    .from(demandSites)
    .where(and(eq(demandSites.programId, body.programId), eq(demandSites.name, body.name)));
  if (duplicateRows.length > 0) {
    return c.json({ error: "같은 사업단에 동일한 이름의 수요처가 이미 있습니다." }, 400);
  }

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
      baseAreaEnabled: body.baseAreaEnabled ?? true,
      // 조를 하나도 안 배정한 채로는 활성화할 수 없다 — 지금 사업단 운영 순서상
      // 수요처를 먼저 만들고 조는 나중에 배정하므로, 새로 만든 수요처는 항상 비활성으로
      // 시작해서 조를 배정한 뒤 관리자가 직접 활성화하게 한다(아래 PUT의 검증 참고).
      isActive: false,
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

  // 조를 하나도 안 배정한 수요처는 활성화할 수 없다 — 이미 활성 상태를 유지하는 건
  // 막지 않고(다른 필드 수정 시 body.isActive를 안 보낼 수도 있음), 꺼진 걸 켜려는
  // 시도만 검증한다.
  if (body.isActive === true && !existing.isActive) {
    const scheduleRows = await db
      .select({ id: demandSiteSchedules.id })
      .from(demandSiteSchedules)
      .where(eq(demandSiteSchedules.demandSiteId, id));
    if (scheduleRows.length === 0) {
      return c.json({ error: "조를 먼저 배정해주세요." }, 400);
    }
  }

  const result = await db
    .update(demandSites)
    .set({
      name: body.name ?? existing.name,
      address,
      // 담당자는 명시적으로 null을 보내 비울 수 있어야 해서 undefined만 걸러낸다
      contactAdminId:
        body.contactAdminId === undefined ? existing.contactAdminId : body.contactAdminId,
      ...normalizeBaseArea(nextBaseArea.baseLat, nextBaseArea.baseLng, nextBaseArea.radius),
      baseAreaEnabled: body.baseAreaEnabled ?? existing.baseAreaEnabled,
      isActive: body.isActive ?? existing.isActive,
    })
    .where(eq(demandSites.id, id))
    .returning();

  return c.json(result[0]);
});

// ── 수요처 하위 거점(원형/다각형) ──

// 안전 관제 지도용 — 수요처 개수만큼 거점을 반복 호출하지 않도록 그 사업단의 모든
// 수요처 거점을 한 번에 내려준다. `/:id/locations`보다 세그먼트가 하나 적어 겹치지 않는다.
app.get("/locations", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.query("programId"));
  if (!programId) return c.json({ error: "사업단을 지정해주세요." }, 400);

  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const siteRows = await db
    .select({ id: demandSites.id })
    .from(demandSites)
    .where(eq(demandSites.programId, programId));
  const demandSiteIds = siteRows.map((site) => site.id);
  if (demandSiteIds.length === 0) return c.json([]);

  const rows = await db
    .select()
    .from(demandSiteLocations)
    .where(inArray(demandSiteLocations.demandSiteId, demandSiteIds));

  return c.json(rows.map(serializeLocation));
});

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

// 직접 그린 원형 거점을 수요처의 "기본 관제구역"으로 승격한다 — 자동 지오코딩된 원이
// 부정확할 때 손으로 정확히 그린 원으로 교체하는 용도. 다각형 거점은 기본 관제구역이
// 원 하나만 지원해서(demand_sites.baseLat/baseLng/radius) 승격할 수 없다.
app.post("/locations/:locationId/promote", async (c) => {
  const auth = getAuth(c);
  const locationId = Number(c.req.param("locationId"));
  const db = drizzle(c.env.DB);

  const locationRows = await db
    .select()
    .from(demandSiteLocations)
    .where(eq(demandSiteLocations.id, locationId));
  const location = locationRows[0];
  if (!location) return c.json({ error: "위치 정보를 찾을 수 없습니다." }, 404);
  if (location.shapeType !== "RADIUS") {
    return c.json({ error: "원형 거점만 기본 관제구역으로 설정할 수 있습니다." }, 400);
  }

  const siteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, location.demandSiteId));
  const site = siteRows[0];
  if (!site) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);

  const program = await loadAccessibleProgram(db, auth, site.programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  await db.batch([
    db
      .update(demandSites)
      .set({
        baseLat: location.baseLat,
        baseLng: location.baseLng,
        radius: location.radius,
        baseAreaEnabled: true,
      })
      .where(eq(demandSites.id, site.id)),
    db.delete(demandSiteLocations).where(eq(demandSiteLocations.id, locationId)),
  ]);

  return c.json({ success: true });
});

// 사업단 상세 화면용 — 수요처 개수만큼 반복 호출하지 않도록 그 사업단의 모든 수요처
// 조 배정을 한 번에 내려준다. `/:id/schedules`와 세그먼트 수가 달라 안 겹친다.
app.get("/schedules", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.query("programId"));
  if (!programId) return c.json({ error: "사업단을 지정해주세요." }, 400);

  const program = await loadAccessibleProgram(db, auth, programId);
  if (!program) return c.json({ error: "이 사업단에 접근할 권한이 없습니다." }, 403);

  const siteRows = await db
    .select({ id: demandSites.id })
    .from(demandSites)
    .where(eq(demandSites.programId, programId));
  const demandSiteIds = siteRows.map((site) => site.id);
  if (demandSiteIds.length === 0) return c.json([]);

  const rows = await db
    .select({
      id: demandSiteSchedules.id,
      demandSiteId: demandSiteSchedules.demandSiteId,
      groupId: demandSiteSchedules.groupId,
      groupName: groups.name,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
    })
    .from(demandSiteSchedules)
    .innerJoin(groups, eq(demandSiteSchedules.groupId, groups.id))
    .where(inArray(demandSiteSchedules.demandSiteId, demandSiteIds));

  return c.json(rows);
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

  // 근무시간은 조 자체 값을 그대로 보여준다(demandSiteSchedules에는 안 남아있음) —
  // 수요처별로 다른 시간을 저장했다가 실제 출퇴근 판정(조 기준)과 어긋나던 문제를 없앴다.
  const rows = await db
    .select({
      id: demandSiteSchedules.id,
      demandSiteId: demandSiteSchedules.demandSiteId,
      groupId: demandSiteSchedules.groupId,
      groupName: groups.name,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
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
  if (!body.groupId) {
    return c.json({ error: "조를 지정해주세요." }, 400);
  }

  const existingRows = await db
    .select()
    .from(demandSiteSchedules)
    .where(
      and(eq(demandSiteSchedules.demandSiteId, id), eq(demandSiteSchedules.groupId, body.groupId)),
    );
  if (existingRows[0]) {
    return c.json({ error: "이미 배치된 조입니다." }, 400);
  }

  const result = await db
    .insert(demandSiteSchedules)
    .values({
      demandSiteId: id,
      groupId: body.groupId,
    })
    .returning();

  return c.json(result[0], 201);
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
