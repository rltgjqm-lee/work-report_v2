import { and, eq, getTableColumns, inArray, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { ROLES, type Env } from "../../types";

import { admins, demandSites, organizations, participants, programs } from "../../db/schema";
import { canAccessOrg, getAuth, hasMinRole, parseIdArray } from "../../lib/authz";

const app = new Hono<Env>();

type OrganizationBody = {
  name?: string;
  address?: string;
  rep?: string;
  phone?: string;
  fax?: string;
  bizNo?: string;
  regionSido?: string;
  regionSigungu?: string;
  organizationType?: string;
  prjYear?: string;
  isActive?: boolean;
};

app.get("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);

  if (auth.role === ROLES.SUPER_ADMIN) {
    return c.json(await db.select().from(organizations));
  }

  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, auth.organizationId as number));
  return c.json(rows);
});

// 드롭다운 등 이름만 필요한 소비자용 — 주소·연락처 등 상세 필드 없이 딱 그 화면이
// 쓰는 컬럼만 DB에서 골라 내려준다. `/:id`보다 먼저 등록해야 "dropdown"이 id로 안 잡힌다.
app.get("/dropdown", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const select = db
    .select({ id: organizations.id, name: organizations.name, isActive: organizations.isActive })
    .from(organizations);

  const rows =
    auth.role === ROLES.SUPER_ADMIN
      ? await select
      : await select.where(eq(organizations.id, auth.organizationId as number));

  return c.json(rows);
});

app.get("/:id", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));

  if (!canAccessOrg(auth, id)) return c.json({ error: "권한이 없습니다." }, 403);

  const db = drizzle(c.env.DB);
  const rows = await db.select().from(organizations).where(eq(organizations.id, id));

  if (!rows[0]) return c.json({ error: "기관을 찾을 수 없습니다." }, 404);
  return c.json(rows[0]);
});

// 기관 상세 패널(기관 관리 화면에서 행을 펼쳤을 때)용 — 소속 직원 · 담당 사업단 ·
// 담당 수요처를 한 번에 조합해서 내려준다. 사업단/수요처 개수만큼 반복 호출하던 걸
// 없애기 위한 전용 라우트라 `/:id`보다 나중에 둬도 상관없다("detail"이 더 긴 경로).
app.get("/:id/detail", async (c) => {
  const auth = getAuth(c);
  const organizationId = Number(c.req.param("id"));
  if (!canAccessOrg(auth, organizationId)) return c.json({ error: "권한이 없습니다." }, 403);

  const db = drizzle(c.env.DB);

  // 소속 직원 목록 — 계정 관리 화면(GET /api/admins)과 달리 role 제한 없이 이 기관에
  // 접근 가능하면(canAccessOrg) 누구나 볼 수 있다.
  const staffRows = await db.select().from(admins).where(eq(admins.organizationId, organizationId));
  const staff = staffRows.map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  }));

  // 사업단 담당자 = MANAGER 또는 SUB_ADMIN.
  const managerAdmins = staffRows.filter(
    (admin) => (admin.role === ROLES.MANAGER || admin.role === ROLES.SUB_ADMIN) && admin.isActive,
  );
  const managerNameByProgramId = (programId: number) => {
    const manager = managerAdmins.find((candidate) =>
      parseIdArray(candidate.programIds).includes(programId),
    );
    return manager?.name ?? manager?.email ?? "-";
  };

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.organizationId, organizationId));
  const programIds = programRows.map((program) => program.id);

  const participantCountRows =
    programIds.length === 0
      ? []
      : await db
          .select({ programId: participants.programId, count: sql<number>`count(*)` })
          .from(participants)
          .where(inArray(participants.programId, programIds))
          .groupBy(participants.programId);
  const participantCountByProgramId = new Map(
    participantCountRows.map((row) => [row.programId, row.count]),
  );

  const programSummaries = programRows.map((program) => ({
    id: program.id,
    name: program.name,
    type: program.programType ?? "-",
    participantCount: participantCountByProgramId.get(program.id) ?? 0,
    managerName: managerNameByProgramId(program.id),
  }));

  const siteRows =
    programIds.length === 0
      ? []
      : await db
          .select({ ...getTableColumns(demandSites), contactAdminName: admins.name })
          .from(demandSites)
          .leftJoin(admins, eq(demandSites.contactAdminId, admins.id))
          .where(inArray(demandSites.programId, programIds));

  // 배치 인원은 조 participantCount와 같은 관례로 활성(ACTIVE) 참여자만 센다.
  const activeCountRows =
    programIds.length === 0
      ? []
      : await db
          .select({ demandSiteId: participants.demandSiteId, count: sql<number>`count(*)` })
          .from(participants)
          .where(
            and(
              inArray(participants.programId, programIds),
              eq(participants.status, "ACTIVE"),
              isNotNull(participants.demandSiteId),
            ),
          )
          .groupBy(participants.demandSiteId);
  const activeCountBySiteId = new Map(
    activeCountRows.map((row) => [row.demandSiteId as number, row.count]),
  );

  const sites = siteRows.map((site) => ({
    id: site.id,
    site: site.name,
    count: activeCountBySiteId.get(site.id) ?? 0,
    manager: site.contactAdminName ?? site.contactPerson ?? "-",
  }));

  return c.json({ staff, programs: programSummaries, sites });
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  if (auth.role !== ROLES.SUPER_ADMIN) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const db = drizzle(c.env.DB);
  const body = await c.req.json<OrganizationBody>();

  if (!body.name) {
    return c.json({ error: "기관명을 입력해주세요." }, 400);
  }

  const result = await db
    .insert(organizations)
    .values({
      name: body.name,
      address: body.address,
      rep: body.rep,
      phone: body.phone,
      fax: body.fax,
      bizNo: body.bizNo,
      regionSido: body.regionSido,
      regionSigungu: body.regionSigungu,
      organizationType: body.organizationType,
      prjYear: body.prjYear,
    })
    .returning();

  return c.json(result[0], 201);
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const id = Number(c.req.param("id"));

  // 기관 정보 수정은 ORGANIZATION_ADMIN 이상만 가능 (SUB_ADMIN/MANAGER는 조회만)
  if (!hasMinRole(auth, ROLES.ORGANIZATION_ADMIN) || !canAccessOrg(auth, id)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const db = drizzle(c.env.DB);
  const body = await c.req.json<OrganizationBody>();

  // 활성/비활성 전환(소프트 삭제)은 SUPER_ADMIN만 — 나머지 필드 수정과는 별개 권한
  if (body.isActive !== undefined && auth.role !== ROLES.SUPER_ADMIN) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const result = await db
    .update(organizations)
    .set(body)
    .where(eq(organizations.id, id))
    .returning();

  if (!result[0]) return c.json({ error: "기관을 찾을 수 없습니다." }, 404);
  return c.json(result[0]);
});

export default app;
