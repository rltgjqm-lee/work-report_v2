import { and, asc, count, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { ROLES, type Env } from "../../types";

import {
  demandSiteLocations,
  demandSites,
  locationTraces,
  participants,
  programs,
} from "../../db/schema";
import { getAuth } from "../../lib/authz";
import { buildDemandSiteAreas } from "../../lib/geofence";

const app = new Hono<Env>();

// 이동 경로 시험 기록(location_traces)은 개인 위치 이력이라 SUPER_ADMIN만 본다.
app.use("*", async (c, next) => {
  if (getAuth(c).role !== ROLES.SUPER_ADMIN) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }
  await next();
});

// 경로가 기록된 참여자·근무일 목록 — 화면이 참여자와 날짜를 고르는 데 쓴다
app.get("/days", async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db
    .select({
      participantId: locationTraces.participantId,
      participantName: participants.name,
      programName: programs.name,
      workDate: locationTraces.workDate,
      pointCount: count(),
    })
    .from(locationTraces)
    .innerJoin(participants, eq(locationTraces.participantId, participants.id))
    .innerJoin(programs, eq(participants.programId, programs.id))
    .groupBy(locationTraces.participantId, locationTraces.workDate)
    .orderBy(desc(locationTraces.workDate), asc(participants.name));

  return c.json(rows);
});

// 참여자 한 명의 하루 경로 + 그 참여자 수요처의 관제구역(지도에 같이 그린다)
app.get("/", async (c) => {
  const participantId = Number(c.req.query("participantId"));
  const workDate = c.req.query("workDate");
  if (!participantId || !workDate) {
    return c.json({ error: "참여자와 날짜를 지정해주세요." }, 400);
  }

  const db = drizzle(c.env.DB);
  const points = await db
    .select({
      id: locationTraces.id,
      receivedAt: locationTraces.receivedAt,
      locatedAt: locationTraces.locatedAt,
      lat: locationTraces.lat,
      lng: locationTraces.lng,
      accuracyM: locationTraces.accuracyM,
      altitudeM: locationTraces.altitudeM,
      simulated: locationTraces.simulated,
      locationSource: locationTraces.locationSource,
      judgement: locationTraces.judgement,
    })
    .from(locationTraces)
    .where(
      and(eq(locationTraces.participantId, participantId), eq(locationTraces.workDate, workDate)),
    )
    .orderBy(asc(locationTraces.receivedAt));

  const participantRows = await db
    .select({ demandSiteId: participants.demandSiteId })
    .from(participants)
    .where(eq(participants.id, participantId));
  const demandSiteId = participantRows[0]?.demandSiteId;

  const demandSiteRows = demandSiteId
    ? await db.select().from(demandSites).where(eq(demandSites.id, demandSiteId))
    : [];
  const demandSite = demandSiteRows[0];
  const locations = demandSite
    ? await db
        .select()
        .from(demandSiteLocations)
        .where(eq(demandSiteLocations.demandSiteId, demandSite.id))
    : [];
  const areas = demandSite
    ? buildDemandSiteAreas(demandSite, locations).map((area) => ({
        shapeType: area.shapeType,
        lat: area.baseLat,
        lng: area.baseLng,
        radius: area.radius,
        polygon: area.polygon ? (JSON.parse(area.polygon) as { lat: number; lng: number }[]) : null,
      }))
    : [];

  return c.json({ demandSiteName: demandSite?.name ?? null, areas, points });
});

export default app;
