import { and, desc, eq, gte, inArray, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { ROLES, type AdminSession, type Env } from "../../types";

import {
  admins,
  attendanceLogs,
  demandSiteLocations,
  demandSites,
  demandSiteSchedules,
  escapeLogs,
  groups,
  organizations,
  participantEscapeMeta,
  participants,
  programs,
  sosEvents,
} from "../../db/schema";
import { canAccessProgram, getAuth } from "../../lib/authz";
import { buildDemandSiteAreas, distanceOutsideAreasM, type GeofenceArea } from "../../lib/geofence";
import { getKstNow } from "../../lib/kst";

// 관리자 앱(apps/admin-mobile) 전용 조회 — PC 콘솔은 사업단 하나를 골라 들어가서 보지만,
// 앱은 담당 사업단 전체의 SOS·이탈·관제 구역을 한 화면에 모아 보여준다. 처리(resolve)는
// PC와 같은 /api/sos, /api/escapes 라우트를 그대로 쓴다.
const app = new Hono<Env>();

type DB = ReturnType<typeof drizzle>;

// D1은 쿼리 하나당 바인딩 파라미터를 100개까지만 허용한다.
const D1_MAX_BOUND_PARAMS = 100;
const RESOLVED_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 처리된 건은 최근 7일만
const RESOLVED_LIMIT = 30;

// canAccessProgram과 같은 기준을 SQL 조건으로 — 목록을 다 가져와서 거르지 않고 조인에서 좁힌다.
const programScope = (auth: AdminSession): SQL => {
  const active = eq(programs.isActive, true);
  if (auth.role === ROLES.SUPER_ADMIN) return active;
  if (auth.role === ROLES.MANAGER) {
    if (auth.programIds.length === 0) return sql`0 = 1`;
    return and(active, inArray(programs.id, auth.programIds)) as SQL;
  }
  if (auth.organizationId === null) return sql`0 = 1`;
  return and(active, eq(programs.organizationId, auth.organizationId)) as SQL;
};

// SOS 요청 시각·이탈 감지 시각·위치 보고 시각은 KST 벽시계 시각에 Z만 붙여 저장한다(getKstNow().iso).
// 앱은 폰 시간대로 그대로 보여주도록 진짜 UTC로 바꿔서 내려준다. 처리 시각(resolvedAt)은
// new Date().toISOString()으로 저장해서 이미 UTC다.
const kstWallToUtcIso = (value: string | null): string | null => {
  if (!value) return null;
  // current_timestamp 기본값("YYYY-MM-DD HH:MM:SS")은 SQLite가 UTC로 찍은 값이다
  if (!value.includes("T")) return new Date(`${value.replace(" ", "T")}Z`).toISOString();
  return new Date(new Date(value).getTime() - 9 * 60 * 60 * 1000).toISOString();
};

type MobileArea = {
  shapeType: "RADIUS" | "POLYGON";
  lat: number | null;
  lng: number | null;
  radius: number | null;
  polygon: { lat: number; lng: number }[] | null;
};

const toMobileArea = (area: GeofenceArea): MobileArea => ({
  shapeType: area.shapeType,
  lat: area.baseLat,
  lng: area.baseLng,
  radius: area.radius,
  polygon: area.polygon ? (JSON.parse(area.polygon) as { lat: number; lng: number }[]) : null,
});

// 수요처 여러 곳의 관제구역(기본 원 + 거점)을 한 번에 모은다.
const loadAreasByDemandSite = async (db: DB, demandSiteIds: number[]) => {
  const areasByDemandSite = new Map<number, GeofenceArea[]>();
  const uniqueIds = [...new Set(demandSiteIds)];
  for (let start = 0; start < uniqueIds.length; start += D1_MAX_BOUND_PARAMS) {
    const chunk = uniqueIds.slice(start, start + D1_MAX_BOUND_PARAMS);
    const [siteRows, locationRows] = await Promise.all([
      db.select().from(demandSites).where(inArray(demandSites.id, chunk)),
      db.select().from(demandSiteLocations).where(inArray(demandSiteLocations.demandSiteId, chunk)),
    ]);
    for (const site of siteRows) {
      const locations = locationRows.filter((location) => location.demandSiteId === site.id);
      areasByDemandSite.set(site.id, buildDemandSiteAreas(site, locations));
    }
  }
  return areasByDemandSite;
};

// 좌표가 수요처 관제구역 밖으로 얼마나 나가 있는지(m). 좌표나 구역이 없으면 판정할 수 없어 null.
const outsideMetersOf = (
  areas: GeofenceArea[] | undefined,
  lat: number | null,
  lng: number | null,
): number | null => {
  if (!areas || areas.length === 0 || lat === null || lng === null) return null;
  const outsideM = distanceOutsideAreasM(lat, lng, areas);
  return Number.isFinite(outsideM) ? Math.round(outsideM) : null;
};

const sosSelection = {
  sos: sosEvents,
  participantName: participants.name,
  programName: programs.name,
  groupName: groups.name,
  demandSiteName: demandSites.name,
  resolverName: admins.name,
};

const selectSosRows = (db: DB) =>
  db
    .select(sosSelection)
    .from(sosEvents)
    .innerJoin(programs, eq(sosEvents.programId, programs.id))
    .innerJoin(participants, eq(sosEvents.participantId, participants.id))
    .leftJoin(groups, eq(participants.groupId, groups.id))
    .leftJoin(demandSites, eq(sosEvents.demandSiteId, demandSites.id))
    .leftJoin(admins, eq(sosEvents.resolvedBy, admins.id));

type SosRow = Awaited<ReturnType<ReturnType<typeof selectSosRows>["where"]>>[number];

const toMobileSos = (row: SosRow, areas: GeofenceArea[] | undefined) => ({
  id: row.sos.id,
  programId: row.sos.programId,
  participantName: row.participantName,
  programName: row.programName,
  groupName: row.groupName,
  demandSiteName: row.demandSiteName,
  triggeredAt: kstWallToUtcIso(row.sos.triggeredAt) as string,
  lat: row.sos.lat,
  lng: row.sos.lng,
  // 요청 순간의 마지막 위치가 관제구역 밖으로 나간 거리 — 0이면 구역 안
  outsideM: outsideMetersOf(areas, row.sos.lat, row.sos.lng),
  status: row.sos.status,
  resolvedAt: row.sos.resolvedAt,
  resolverName: row.resolverName,
  memo: row.sos.memo,
});

const escapeSelection = {
  escape: escapeLogs,
  participantName: participants.name,
  programName: programs.name,
  groupName: groups.name,
  demandSiteName: demandSites.name,
  resolverName: admins.name,
  lastLat: participantEscapeMeta.lastLat,
  lastLng: participantEscapeMeta.lastLng,
  lastLocationAt: participantEscapeMeta.lastLocationAt,
  lastOutsideM: participantEscapeMeta.lastOutsideM,
};

const selectEscapeRows = (db: DB) =>
  db
    .select(escapeSelection)
    .from(escapeLogs)
    .innerJoin(programs, eq(escapeLogs.programId, programs.id))
    .innerJoin(participants, eq(escapeLogs.participantId, participants.id))
    .leftJoin(groups, eq(participants.groupId, groups.id))
    .leftJoin(demandSites, eq(escapeLogs.demandSiteId, demandSites.id))
    .leftJoin(admins, eq(escapeLogs.resolvedBy, admins.id))
    .leftJoin(
      participantEscapeMeta,
      eq(participantEscapeMeta.participantId, escapeLogs.participantId),
    );

type EscapeRow = Awaited<ReturnType<ReturnType<typeof selectEscapeRows>["where"]>>[number];

const toMobileEscape = (row: EscapeRow) => {
  const isOpen = row.escape.status === "OPEN";
  // 진행 중이면 지금 위치(마지막 보고)를, 끝났으면 이탈을 판정한 그 위치를 보여준다
  const hasLivePosition = isOpen && row.lastLat !== null && row.lastLng !== null;
  return {
    id: row.escape.id,
    programId: row.escape.programId,
    participantName: row.participantName,
    programName: row.programName,
    groupName: row.groupName,
    demandSiteName: row.demandSiteName,
    detectedAt: kstWallToUtcIso(row.escape.detectedAt) as string,
    // 이탈로 판정한 순간 구역 경계 밖으로 나간 거리
    detectedOutsideM: Math.round(row.escape.distanceKm * 1000),
    // 진행 중일 때 마지막 위치 보고 기준 경계 밖 거리 — 구역 안으로 돌아왔으면 0
    currentOutsideM: isOpen && row.lastLocationAt ? (row.lastOutsideM ?? 0) : null,
    lastLocationAt: isOpen ? kstWallToUtcIso(row.lastLocationAt) : null,
    lat: hasLivePosition ? row.lastLat : row.escape.lat,
    lng: hasLivePosition ? row.lastLng : row.escape.lng,
    alertCount: row.escape.alertCount,
    status: row.escape.status,
    resolvedAt: row.escape.resolvedAt,
    resolverName: row.resolverName,
    memo: row.escape.memo,
  };
};

const resolvedSince = () => new Date(Date.now() - RESOLVED_LOOKBACK_MS).toISOString();

// 안전 탭 — 미처리 SOS·진행 중 이탈은 전부, 처리된 건은 최근 7일에서 30건까지.
// 홈의 "확인이 필요해요"·"최근 처리"와 하단 탭 뱃지도 이 응답 하나로 그린다.
app.get("/safety", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const scope = programScope(auth);
  const since = resolvedSince();

  const [openSosRows, resolvedSosRows, openEscapeRows, resolvedEscapeRows] = await Promise.all([
    selectSosRows(db)
      .where(and(scope, eq(sosEvents.status, "OPEN")))
      .orderBy(desc(sosEvents.triggeredAt)),
    selectSosRows(db)
      .where(and(scope, eq(sosEvents.status, "RESOLVED"), gte(sosEvents.resolvedAt, since)))
      .orderBy(desc(sosEvents.resolvedAt))
      .limit(RESOLVED_LIMIT),
    selectEscapeRows(db)
      .where(and(scope, eq(escapeLogs.status, "OPEN")))
      .orderBy(desc(escapeLogs.detectedAt)),
    selectEscapeRows(db)
      .where(and(scope, eq(escapeLogs.status, "RESOLVED"), gte(escapeLogs.resolvedAt, since)))
      .orderBy(desc(escapeLogs.resolvedAt))
      .limit(RESOLVED_LIMIT),
  ]);

  const sosRows = [...openSosRows, ...resolvedSosRows];
  const areasByDemandSite = await loadAreasByDemandSite(
    db,
    sosRows.flatMap((row) => (row.sos.demandSiteId === null ? [] : [row.sos.demandSiteId])),
  );

  return c.json({
    sos: sosRows.map((row) =>
      toMobileSos(
        row,
        row.sos.demandSiteId === null ? undefined : areasByDemandSite.get(row.sos.demandSiteId),
      ),
    ),
    escapes: [...openEscapeRows, ...resolvedEscapeRows].map(toMobileEscape),
  });
});

app.get("/sos/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const rows = await selectSosRows(db).where(eq(sosEvents.id, id));
  const row = rows[0];
  if (!row) return c.json({ error: "SOS 기록을 찾을 수 없습니다." }, 404);
  const programRows = await db.select().from(programs).where(eq(programs.id, row.sos.programId));
  if (!programRows[0] || !canAccessProgram(auth, programRows[0])) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const areas =
    row.sos.demandSiteId === null
      ? []
      : ((await loadAreasByDemandSite(db, [row.sos.demandSiteId])).get(row.sos.demandSiteId) ?? []);

  return c.json({ sos: toMobileSos(row, areas), areas: areas.map(toMobileArea) });
});

app.get("/escapes/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const rows = await selectEscapeRows(db).where(eq(escapeLogs.id, id));
  const row = rows[0];
  if (!row) return c.json({ error: "이탈 기록을 찾을 수 없습니다." }, 404);
  const programRows = await db.select().from(programs).where(eq(programs.id, row.escape.programId));
  if (!programRows[0] || !canAccessProgram(auth, programRows[0])) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const areas =
    row.escape.demandSiteId === null
      ? []
      : ((await loadAreasByDemandSite(db, [row.escape.demandSiteId])).get(
          row.escape.demandSiteId,
        ) ?? []);

  return c.json({ escape: toMobileEscape(row), areas: areas.map(toMobileArea) });
});

// 홈 상단 숫자 — 미처리 SOS·지금 이탈 수는 /safety에서 세고, 여기선 그 밖의 것만 준다.
app.get("/home", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const scope = programScope(auth);
  const { date } = getKstNow();

  const [organizationRows, clockInRows, zoneRows, escapeZoneRows] = await Promise.all([
    auth.organizationId === null
      ? Promise.resolve([])
      : db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, auth.organizationId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceLogs)
      .innerJoin(programs, eq(attendanceLogs.programId, programs.id))
      .where(
        and(
          scope,
          eq(attendanceLogs.workDate, date),
          isNotNull(attendanceLogs.clockIn),
          ne(attendanceLogs.status, "INVALID"),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(demandSites)
      .innerJoin(programs, eq(demandSites.programId, programs.id))
      .where(and(scope, eq(demandSites.isActive, true))),
    db
      .select({ count: sql<number>`count(distinct ${escapeLogs.demandSiteId})` })
      .from(escapeLogs)
      .innerJoin(programs, eq(escapeLogs.programId, programs.id))
      .where(and(scope, eq(escapeLogs.status, "OPEN"))),
  ]);

  return c.json({
    organizationName: organizationRows[0]?.name ?? null,
    todayClockInCount: clockInRows[0]?.count ?? 0,
    zoneCount: zoneRows[0]?.count ?? 0,
    escapeZoneCount: escapeZoneRows[0]?.count ?? 0,
  });
});

// "09:00 – 13:00"처럼 그 수요처에 배치된 조들의 근무시간. 조마다 다르면 쉼표로 잇는다.
const toScheduleLabel = (schedules: { shiftStart: string; shiftEnd: string }[]) => {
  const labels = [
    ...new Set(schedules.map((schedule) => `${schedule.shiftStart} – ${schedule.shiftEnd}`)),
  ];
  return labels.length === 0 ? null : labels.join(", ");
};

// 관제 구역 탭 — 담당 사업단의 운영 중인 수요처 전부. 반경·근무시간 변경은 PC에서만 한다.
app.get("/zones", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const scope = programScope(auth);
  const { date } = getKstNow();

  const siteRows = await db
    .select({
      id: demandSites.id,
      name: demandSites.name,
      address: demandSites.address,
      radius: demandSites.radius,
      baseAreaEnabled: demandSites.baseAreaEnabled,
      baseLat: demandSites.baseLat,
      programName: programs.name,
    })
    .from(demandSites)
    .innerJoin(programs, eq(demandSites.programId, programs.id))
    .where(and(scope, eq(demandSites.isActive, true)))
    .orderBy(demandSites.name);

  // 수요처별 숫자는 수요처 id 목록 대신 같은 범위 조건으로 묶어서 센다(바인딩 100개 제한).
  const [scheduleRows, locationCountRows, assignedRows, workingRows, openEscapeRows] =
    await Promise.all([
      db
        .select({
          demandSiteId: demandSiteSchedules.demandSiteId,
          shiftStart: groups.shiftStart,
          shiftEnd: groups.shiftEnd,
        })
        .from(demandSiteSchedules)
        .innerJoin(groups, eq(demandSiteSchedules.groupId, groups.id))
        .innerJoin(programs, eq(groups.programId, programs.id))
        .where(scope),
      db
        .select({ demandSiteId: demandSiteLocations.demandSiteId, count: sql<number>`count(*)` })
        .from(demandSiteLocations)
        .innerJoin(demandSites, eq(demandSiteLocations.demandSiteId, demandSites.id))
        .innerJoin(programs, eq(demandSites.programId, programs.id))
        .where(scope)
        .groupBy(demandSiteLocations.demandSiteId),
      db
        .select({ demandSiteId: participants.demandSiteId, count: sql<number>`count(*)` })
        .from(participants)
        .innerJoin(programs, eq(participants.programId, programs.id))
        .where(and(scope, eq(participants.status, "ACTIVE"), isNotNull(participants.demandSiteId)))
        .groupBy(participants.demandSiteId),
      db
        .select({ demandSiteId: participants.demandSiteId, count: sql<number>`count(*)` })
        .from(attendanceLogs)
        .innerJoin(participants, eq(attendanceLogs.participantId, participants.id))
        .innerJoin(programs, eq(participants.programId, programs.id))
        .where(
          and(
            scope,
            eq(attendanceLogs.workDate, date),
            isNotNull(attendanceLogs.clockIn),
            isNull(attendanceLogs.clockOut),
            ne(attendanceLogs.status, "INVALID"),
          ),
        )
        .groupBy(participants.demandSiteId),
      db
        .select({ demandSiteId: escapeLogs.demandSiteId, count: sql<number>`count(*)` })
        .from(escapeLogs)
        .innerJoin(programs, eq(escapeLogs.programId, programs.id))
        .where(and(scope, eq(escapeLogs.status, "OPEN")))
        .groupBy(escapeLogs.demandSiteId),
    ]);

  const countOf = (rows: { demandSiteId: number | null; count: number }[], demandSiteId: number) =>
    rows.find((row) => row.demandSiteId === demandSiteId)?.count ?? 0;

  return c.json({
    zones: siteRows.map((site) => ({
      id: site.id,
      name: site.name,
      address: site.address,
      programName: site.programName,
      // 기본 원을 관제에 쓰는 경우에만 반경을 보여준다(다각형만 쓰면 null)
      radius: site.baseAreaEnabled && site.baseLat !== null ? site.radius : null,
      polygonCount: countOf(locationCountRows, site.id),
      scheduleLabel: toScheduleLabel(
        scheduleRows.filter((schedule) => schedule.demandSiteId === site.id),
      ),
      assignedCount: countOf(assignedRows, site.id),
      workingCount: countOf(workingRows, site.id),
      escapeCount: countOf(openEscapeRows, site.id),
    })),
  });
});

// 구역 상세 — 지도에 그릴 관제구역과, 배치된 참여자의 오늘 상태·마지막 위치.
app.get("/zones/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const { date } = getKstNow();

  const siteRows = await db
    .select({ site: demandSites, program: programs })
    .from(demandSites)
    .innerJoin(programs, eq(demandSites.programId, programs.id))
    .where(eq(demandSites.id, id));
  const siteRow = siteRows[0];
  if (!siteRow) return c.json({ error: "수요처를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, siteRow.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const [locationRows, scheduleRows, memberRows, openEscapeRows, escapeTodayRows] =
    await Promise.all([
      db.select().from(demandSiteLocations).where(eq(demandSiteLocations.demandSiteId, id)),
      db
        .select({ shiftStart: groups.shiftStart, shiftEnd: groups.shiftEnd })
        .from(demandSiteSchedules)
        .innerJoin(groups, eq(demandSiteSchedules.groupId, groups.id))
        .where(eq(demandSiteSchedules.demandSiteId, id)),
      db
        .select({
          participantId: participants.id,
          name: participants.name,
          groupName: groups.name,
          clockIn: attendanceLogs.clockIn,
          clockOut: attendanceLogs.clockOut,
          lastLat: participantEscapeMeta.lastLat,
          lastLng: participantEscapeMeta.lastLng,
          lastLocationAt: participantEscapeMeta.lastLocationAt,
          lastJudgement: participantEscapeMeta.lastJudgement,
          lastOutsideM: participantEscapeMeta.lastOutsideM,
        })
        .from(participants)
        .leftJoin(groups, eq(participants.groupId, groups.id))
        .leftJoin(
          attendanceLogs,
          and(
            eq(attendanceLogs.participantId, participants.id),
            eq(attendanceLogs.workDate, date),
            ne(attendanceLogs.status, "INVALID"),
          ),
        )
        .leftJoin(participantEscapeMeta, eq(participantEscapeMeta.participantId, participants.id))
        .where(and(eq(participants.demandSiteId, id), eq(participants.status, "ACTIVE")))
        .orderBy(participants.name),
      db
        .select({ participantId: escapeLogs.participantId })
        .from(escapeLogs)
        .where(and(eq(escapeLogs.demandSiteId, id), eq(escapeLogs.status, "OPEN"))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(escapeLogs)
        .where(and(eq(escapeLogs.demandSiteId, id), gte(escapeLogs.detectedAt, date))),
    ]);

  const escapingIds = new Set(openEscapeRows.map((row) => row.participantId));
  const areas = buildDemandSiteAreas(siteRow.site, locationRows);

  const members = memberRows.map((member) => {
    const isWorking = member.clockIn !== null && member.clockOut === null;
    const state = !member.clockIn
      ? ("NOT_CLOCKED_IN" as const)
      : member.clockOut
        ? ("CLOCKED_OUT" as const)
        : escapingIds.has(member.participantId)
          ? ("ESCAPE" as const)
          : member.lastJudgement === "OUTSIDE" || member.lastJudgement === "UNCERTAIN"
            ? ("UNCERTAIN" as const)
            : ("INSIDE" as const);
    return {
      participantId: member.participantId,
      name: member.name,
      groupName: member.groupName,
      state,
      // 출퇴근 시각도 KST 벽시계 시각이라 "HH:MM"만 잘라서 준다
      clockInTime: member.clockIn ? member.clockIn.slice(11, 16) : null,
      clockOutTime: member.clockOut ? member.clockOut.slice(11, 16) : null,
      // 근무 중인 사람만 지도에 찍는다 — 퇴근한 사람의 마지막 위치는 보여주지 않는다
      lat: isWorking ? member.lastLat : null,
      lng: isWorking ? member.lastLng : null,
      lastLocationAt: isWorking ? kstWallToUtcIso(member.lastLocationAt) : null,
      outsideM: isWorking ? member.lastOutsideM : null,
    };
  });

  return c.json({
    zone: {
      id: siteRow.site.id,
      name: siteRow.site.name,
      address: siteRow.site.address,
      programName: siteRow.program.name,
      radius:
        siteRow.site.baseAreaEnabled && siteRow.site.baseLat !== null ? siteRow.site.radius : null,
      polygonCount: locationRows.length,
      scheduleLabel: toScheduleLabel(scheduleRows),
      assignedCount: members.length,
      workingCount: members.filter(
        (member) => member.state !== "NOT_CLOCKED_IN" && member.state !== "CLOCKED_OUT",
      ).length,
      escapeCount: escapingIds.size,
    },
    escapeTodayCount: escapeTodayRows[0]?.count ?? 0,
    areas: areas.map(toMobileArea),
    members,
  });
});

export default app;
