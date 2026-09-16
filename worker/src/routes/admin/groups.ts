import { and, eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import type { Env } from "../../types";

import {
  groupMonthlySchedule,
  groups,
  groupShiftOverrides,
  participants,
  programs,
} from "../../db/schema";
import { canAccessProgram, getAuth } from "../../lib/authz";

const app = new Hono<Env>();

interface GroupShiftOverrideInput {
  date: string;
  shiftStart: string;
  shiftEnd: string;
}

interface MonthScheduleInput {
  yearMonth: string;
  workDates: string[];
  maxMonthlyMinutes?: number;
  // 생략하면 그 달의 날짜별 근무시간을 건드리지 않는다 — 빈 배열(전부 삭제)과 다르다.
  shiftOverrides?: GroupShiftOverrideInput[];
}

const DEFAULT_MAX_MONTHLY_MINUTES = 1800;

// 문제가 있으면 에러 메시지를, 정상이면 null을 돌려준다. 쓰기와 분리해 둔 건 여러 달을
// 한 번에 저장할 때 검증을 전부 먼저 돌리기 위해서다 — 3번째 달에서 걸려도 앞 두 달이
// 이미 저장된 상태로 남으면 안 된다.
const validateShiftOverrides = (
  yearMonth: string,
  workDates: string[],
  shiftOverrides: GroupShiftOverrideInput[] | undefined,
): string | null => {
  if (!shiftOverrides) return null;

  const workDateSet = new Set(workDates);
  for (const override of shiftOverrides) {
    if (!override.date.startsWith(yearMonth)) {
      return `${override.date}는 ${yearMonth}의 날짜가 아닙니다.`;
    }
    // 근무일이 아닌 날의 근무시간은 아무 데서도 안 쓰이니(근무일 여부가 먼저 판정된다)
    // 저장 자체를 막아 "시간은 정해뒀는데 왜 출근이 안 되지" 상태를 안 만든다.
    if (!workDateSet.has(override.date)) {
      return `${override.date}는 근무일이 아니라 근무시간을 지정할 수 없습니다.`;
    }
    if (!override.shiftStart || !override.shiftEnd || override.shiftStart >= override.shiftEnd) {
      return `${override.date}의 근무시간이 올바르지 않습니다.`;
    }
  }

  return null;
};

// 그 조의 그 달 날짜별 근무시간을 통째로 갈아끼운다 — 보낸 목록에 없는 그 달 행은
// 지운다(모달에서 지운 날짜가 그대로 사라져야 하니). 다른 달 행은 건드리지 않는다.
// 호출 전에 validateShiftOverrides를 통과시켜야 한다.
const replaceShiftOverrides = async (
  db: ReturnType<typeof drizzle>,
  groupId: number,
  yearMonth: string,
  shiftOverrides: GroupShiftOverrideInput[] | undefined,
): Promise<void> => {
  if (!shiftOverrides) return;

  await db
    .delete(groupShiftOverrides)
    .where(
      and(
        eq(groupShiftOverrides.groupId, groupId),
        like(groupShiftOverrides.date, `${yearMonth}%`),
      ),
    );

  if (shiftOverrides.length > 0) {
    await db.insert(groupShiftOverrides).values(
      shiftOverrides.map((override) => ({
        groupId,
        date: override.date,
        shiftStart: override.shiftStart,
        shiftEnd: override.shiftEnd,
      })),
    );
  }
};

const upsertMonthlySchedule = async (
  db: ReturnType<typeof drizzle>,
  groupId: number,
  month: MonthScheduleInput,
): Promise<void> => {
  const existingRows = await db
    .select()
    .from(groupMonthlySchedule)
    .where(
      and(
        eq(groupMonthlySchedule.groupId, groupId),
        eq(groupMonthlySchedule.yearMonth, month.yearMonth),
      ),
    );
  const existing = existingRows[0];
  const workDates = JSON.stringify(month.workDates);
  const maxMonthlyMinutes = month.maxMonthlyMinutes ?? DEFAULT_MAX_MONTHLY_MINUTES;

  if (existing) {
    await db
      .update(groupMonthlySchedule)
      .set({ workDates, maxMonthlyMinutes })
      .where(eq(groupMonthlySchedule.id, existing.id));

    return;
  }

  await db
    .insert(groupMonthlySchedule)
    .values({ groupId, yearMonth: month.yearMonth, workDates, maxMonthlyMinutes });
};

const loadGroupWithProgram = async (db: ReturnType<typeof drizzle>, groupId: number) => {
  const groupRows = await db.select().from(groups).where(eq(groups.id, groupId));
  const group = groupRows[0];
  if (!group) return null;

  const programRows = await db.select().from(programs).where(eq(programs.id, group.programId));
  const program = programRows[0];
  if (!program) return null;

  return { group, program };
};

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "조를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    description?: string;
    shiftStart?: string;
    shiftEnd?: string;
    isActive?: boolean;
  }>();

  // 비활성화(소프트 삭제)는 활성 참여자가 배정돼 있으면 먼저 다른 조로 옮기게 막는다
  if (body.isActive === false) {
    const members = await db
      .select()
      .from(participants)
      .where(and(eq(participants.groupId, id), eq(participants.status, "ACTIVE")));

    if (members.length > 0) {
      return c.json(
        {
          error: `해당 조에 ${members.length}명이 배정되어 있어 비활성화할 수 없습니다.`,
        },
        400,
      );
    }
  }

  const result = await db.update(groups).set(body).where(eq(groups.id, id)).returning();

  return c.json(result[0]);
});

// 참여자 쪽 명단에서 "팀장 지정"을 누르면 호출된다. participantId를 groups.leaderId에
// 그대로 덮어쓰는 방식이라, 이전 팀장을 따로 해제하는 로직 없이도 조당 팀장이 항상
// 최대 1명으로 유지된다. participantId가 null이면 팀장 해제.
app.post("/:id/leader", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "조를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ participantId?: number | null }>();

  if (body.participantId) {
    const participantRows = await db
      .select()
      .from(participants)
      .where(eq(participants.id, body.participantId));
    const participant = participantRows[0];
    if (!participant || participant.groupId !== id) {
      return c.json({ error: "이 조에 배정된 참여자만 팀장으로 지정할 수 있습니다." }, 400);
    }
  }

  const result = await db
    .update(groups)
    .set({ leaderId: body.participantId ?? null })
    .where(eq(groups.id, id))
    .returning();

  return c.json(result[0]);
});

// 역량활용 월간 근무 스케줄(조 기본값) 조회 — 참여자 개인 예외는 participants.ts 참고
app.get("/:id/monthly-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "조를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const yearMonth = c.req.query("month");
  if (!yearMonth) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  // 날짜별 근무시간(shiftOverrides)은 조 기본 근무시간과 다른 날만 행으로 있다 — 행이
  // 없는 근무일은 조 기본값으로 근무한다는 뜻이다(판정은 lib/scheduling.ts의
  // resolveGroupShift). 근무일과 항상 같은 모달에서 같이 편집되니 한 응답으로 같이 내려준다.
  const [rows, overrideRows] = await Promise.all([
    db
      .select()
      .from(groupMonthlySchedule)
      .where(
        and(eq(groupMonthlySchedule.groupId, id), eq(groupMonthlySchedule.yearMonth, yearMonth)),
      ),
    db
      .select({
        date: groupShiftOverrides.date,
        shiftStart: groupShiftOverrides.shiftStart,
        shiftEnd: groupShiftOverrides.shiftEnd,
      })
      .from(groupShiftOverrides)
      .where(
        and(eq(groupShiftOverrides.groupId, id), like(groupShiftOverrides.date, `${yearMonth}%`)),
      ),
  ]);
  const schedule = rows[0];

  return c.json({
    groupId: id,
    yearMonth,
    workDates: schedule ? (JSON.parse(schedule.workDates) as string[]) : [],
    maxMonthlyMinutes: schedule?.maxMonthlyMinutes ?? DEFAULT_MAX_MONTHLY_MINUTES,
    shiftOverrides: overrideRows,
  });
});

// 사업단 기간 전체의 편성을 한 번에 조회한다 — 조 편성 화면이 달을 넘기며 볼 때마다
// 다시 요청하지 않도록 기간 전체를 한 번에 내려준다. 근무일이 없는 달은 그냥 빠져
// 있으니, 화면에서 그 달은 "미편성"으로 다루면 된다.
app.get("/:id/schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "조를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const [scheduleRows, overrideRows] = await Promise.all([
    db.select().from(groupMonthlySchedule).where(eq(groupMonthlySchedule.groupId, id)),
    db
      .select({
        date: groupShiftOverrides.date,
        shiftStart: groupShiftOverrides.shiftStart,
        shiftEnd: groupShiftOverrides.shiftEnd,
      })
      .from(groupShiftOverrides)
      .where(eq(groupShiftOverrides.groupId, id)),
  ]);

  const months = scheduleRows
    .map((schedule) => ({
      yearMonth: schedule.yearMonth,
      workDates: JSON.parse(schedule.workDates) as string[],
      maxMonthlyMinutes: schedule.maxMonthlyMinutes,
      shiftOverrides: overrideRows.filter((override) =>
        override.date.startsWith(schedule.yearMonth),
      ),
    }))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  return c.json({ groupId: id, months });
});

// 사업단 기간 전체의 편성을 한 번에 저장한다 — 조를 만들 때 기간 전체를 깔아두는
// 화면(GroupAddModal)이 12개월이면 12번 호출하게 되고, 중간에 실패하면 반쯤 편성된
// 조가 남기 때문에 달 단위가 아니라 목록을 통째로 받는다. 보낸 달만 덮어쓰고,
// 목록에 없는 달은 건드리지 않는다.
app.put("/:id/schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "조를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ months?: MonthScheduleInput[] }>();
  if (!body.months?.length) {
    return c.json({ error: "저장할 편성을 지정해주세요." }, 400);
  }

  const duplicatedMonth = body.months.find(
    (month, index) =>
      body.months!.findIndex((other) => other.yearMonth === month.yearMonth) !== index,
  );
  if (duplicatedMonth) {
    return c.json({ error: `${duplicatedMonth.yearMonth}이 중복으로 들어왔습니다.` }, 400);
  }

  // 한 달이라도 잘못됐으면 아무것도 안 쓴다 — 앞쪽 달만 저장되고 뒤쪽이 실패해서
  // 편성이 반만 들어간 상태를 만들지 않기 위해 검증을 먼저 전부 돌린다.
  for (const month of body.months) {
    if (!month.yearMonth || !month.workDates) {
      return c.json({ error: "연월과 근무일을 지정해주세요." }, 400);
    }
    const error = validateShiftOverrides(month.yearMonth, month.workDates, month.shiftOverrides);
    if (error) return c.json({ error }, 400);
  }

  for (const month of body.months) {
    await replaceShiftOverrides(db, id, month.yearMonth, month.shiftOverrides);
    await upsertMonthlySchedule(db, id, month);
  }

  return c.json({ groupId: id, months: body.months });
});

// 참여자 일괄 조 이동
app.post("/bulk-assign", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);

  const body = await c.req.json<{
    participantIds?: number[];
    groupId?: number;
  }>();

  if (!body.participantIds?.length || !body.groupId) {
    return c.json({ error: "참여자와 조를 지정해주세요." }, 400);
  }

  const found = await loadGroupWithProgram(db, body.groupId);
  if (!found) return c.json({ error: "조를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const result = await db
    .update(participants)
    .set({ groupId: body.groupId })
    .where(inArray(participants.id, body.participantIds))
    .returning();

  return c.json({ updated: result.length });
});

export default app;
