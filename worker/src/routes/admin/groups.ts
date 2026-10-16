import { and, eq, inArray, like, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono, type Context } from "hono";

import type { Env } from "../../types";

import {
  groupLeaves,
  groupMonthlySchedule,
  groups,
  groupShiftOverrides,
  participantAnnualLeave,
  participantLeaves,
  participants,
  programs,
} from "../../db/schema";
import { canAccessProgram, getAuth } from "../../lib/authz";
import { getKstNow } from "../../lib/kst";
import { syncLeaveStatus } from "../../lib/leaveStatus";

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

type LeaveType = "PAID" | "UNPAID";

interface GroupLeaveInput {
  date: string;
  leaveType: LeaveType;
}

interface AnnualLeaveShortage {
  participantId: number;
  name: string;
  year: string;
  remainingDays: number;
  requiredDays: number;
}

// D1은 쿼리 하나에 바인딩 100개까지라 inArray·다건 insert를 이 크기로 쪼갠다.
const BINDING_CHUNK_SIZE = 90;
const INSERT_ROW_CHUNK_SIZE = 10;

const chunked = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const validateGroupLeaves = (
  leaves: GroupLeaveInput[],
  programStartDate: string,
  programEndDate: string,
): string | null => {
  const seenDates = new Set<string>();
  for (const leave of leaves) {
    if (!DATE_PATTERN.test(leave.date)) return `${leave.date}는 올바른 날짜가 아닙니다.`;
    if (leave.leaveType !== "PAID" && leave.leaveType !== "UNPAID") {
      return `${leave.date}의 휴무 유형이 올바르지 않습니다.`;
    }
    // 과거 날짜는 막지 않는다 — 지난 휴무를 소급해서 찍는 경우가 있다. 사업단 기간만 본다.
    if (leave.date < programStartDate || leave.date > programEndDate) {
      return `${leave.date}는 사업단 기간(${programStartDate} ~ ${programEndDate}) 밖입니다.`;
    }
    if (seenDates.has(leave.date)) return `${leave.date}이 중복으로 들어왔습니다.`;
    seenDates.add(leave.date);
  }

  return null;
};

const yearOf = (date: string) => date.slice(0, 4);

const countByParticipantYear = (rows: { participantId: number; date: string }[]) => {
  const counts = new Map<string, { participantId: number; year: string; days: number }>();
  for (const row of rows) {
    const key = `${row.participantId}_${yearOf(row.date)}`;
    const current = counts.get(key);
    if (current) current.days += 1;
    else counts.set(key, { participantId: row.participantId, year: yearOf(row.date), days: 1 });
  }

  return [...counts.values()];
};

/**
 * 지금 저장된 조 휴무와 요청을 비교해 지울 것·새로 넣을 것을 나누고, 새로 넣을 유급
 * 휴무만큼 연차가 모자란 조원을 찾는다. 미리보기(팝업용)와 실제 저장이 같은 계산을 써야
 * 팝업에서 본 명단과 실제로 빠지는 사람이 어긋나지 않는다.
 *
 * 유형이 바뀐 날짜(유급→무급 등)는 지우고 다시 넣는 것으로 다룬다. 지우는 쪽 유급은
 * 연차가 먼저 돌아오므로, 부족 여부는 "잔여 + 돌려받을 일수"로 본다.
 */
const planGroupLeaves = async (
  db: ReturnType<typeof drizzle>,
  groupId: number,
  requested: GroupLeaveInput[],
) => {
  const [existingRows, memberRows, annualRows] = await Promise.all([
    db.select().from(groupLeaves).where(eq(groupLeaves.groupId, groupId)),
    db
      .select({ id: participants.id, name: participants.name })
      .from(participants)
      .where(and(eq(participants.groupId, groupId), ne(participants.status, "DROPPED"))),
    db
      .select({
        participantId: participantAnnualLeave.participantId,
        year: participantAnnualLeave.year,
        remainingDays: participantAnnualLeave.remainingDays,
      })
      .from(participantAnnualLeave)
      .innerJoin(participants, eq(participantAnnualLeave.participantId, participants.id))
      .where(eq(participants.groupId, groupId)),
  ]);

  const requestedTypeByDate = new Map(requested.map((leave) => [leave.date, leave.leaveType]));
  const existingTypeByDate = new Map(existingRows.map((leave) => [leave.date, leave.leaveType]));

  const removed = existingRows.filter(
    (existing) => requestedTypeByDate.get(existing.date) !== existing.leaveType,
  );
  const added = requested.filter((leave) => existingTypeByDate.get(leave.date) !== leave.leaveType);

  const removedRecords = (
    await Promise.all(
      chunked(
        removed.map((leave) => leave.id),
        BINDING_CHUNK_SIZE,
      ).map((removedIds) =>
        db
          .select({
            participantId: participantLeaves.participantId,
            date: participantLeaves.leaveStart,
            leaveType: participantLeaves.leaveType,
          })
          .from(participantLeaves)
          .where(inArray(participantLeaves.groupLeaveId, removedIds)),
      ),
    )
  ).flat();

  const addedPaidDates = added
    .filter((leave) => leave.leaveType === "PAID")
    .map((leave) => leave.date);
  const addedPaidYears = [...new Set(addedPaidDates.map(yearOf))];

  const shortages: AnnualLeaveShortage[] = memberRows.flatMap((member) =>
    addedPaidYears.flatMap((year) => {
      const requiredDays = addedPaidDates.filter((date) => yearOf(date) === year).length;
      const refundDays = removedRecords.filter(
        (record) =>
          record.participantId === member.id &&
          record.leaveType === "PAID" &&
          yearOf(record.date) === year,
      ).length;
      const savedRemainingDays =
        annualRows.find(
          (annualRow) => annualRow.participantId === member.id && annualRow.year === year,
        )?.remainingDays ?? 0;
      const remainingDays = savedRemainingDays + refundDays;

      return remainingDays < requiredDays
        ? [{ participantId: member.id, name: member.name, year, remainingDays, requiredDays }]
        : [];
    }),
  );

  return { existingRows, removed, added, memberRows, removedRecords, shortages };
};

const parseGroupLeavesBody = async (c: Context<Env>) => {
  const body = await c.req.json<{ leaves?: GroupLeaveInput[] }>();

  return body.leaves;
};

// 조 일괄 휴무 목록 — 조 수정 달력이 근무일 위에 겹쳐 그린다.
app.get("/:id/leaves", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "조를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const rows = await db
    .select({ date: groupLeaves.date, leaveType: groupLeaves.leaveType })
    .from(groupLeaves)
    .where(eq(groupLeaves.groupId, id))
    .orderBy(groupLeaves.date);

  return c.json({ groupId: id, leaves: rows });
});

// 저장 전 미리보기 — 새로 넣을 유급 휴무만큼 연차가 모자란 조원 명단. 화면은 이걸로
// "이 사람들은 빼고 진행할까요?"를 먼저 묻고, 진행하면 PUT을 보낸다.
app.post("/:id/leaves/preview", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "조를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const leaves = await parseGroupLeavesBody(c);
  if (!leaves) return c.json({ error: "휴무 목록을 지정해주세요." }, 400);
  const error = validateGroupLeaves(leaves, found.program.startDate, found.program.endDate);
  if (error) return c.json({ error }, 400);

  const { shortages } = await planGroupLeaves(db, id, leaves);

  return c.json({ shortages });
});

// 조 일괄 휴무를 통째로 저장한다 — 보낸 목록이 그 조의 휴무 전체가 된다. 달라진 날짜만
// 조원 개인 휴무(participant_leaves, 하루짜리)를 지우고/만들고, 유급이면 그 날짜 연도의
// 연차를 돌려주고/뺀다. 연차가 모자란 조원은 그 유급 휴무에서만 빠지고(무급은 그대로
// 들어간다) skipped로 알려준다 — 미리보기 이후 잔여가 바뀌어도 연차를 마이너스로 만들지 않는다.
app.put("/:id/leaves", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadGroupWithProgram(db, id);
  if (!found) return c.json({ error: "조를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const leaves = await parseGroupLeavesBody(c);
  if (!leaves) return c.json({ error: "휴무 목록을 지정해주세요." }, 400);
  const error = validateGroupLeaves(leaves, found.program.startDate, found.program.endDate);
  if (error) return c.json({ error }, 400);

  const { removed, added, memberRows, removedRecords, shortages } = await planGroupLeaves(
    db,
    id,
    leaves,
  );

  // 1) 빠진 날짜: 개인 기록과 조 휴무를 지우고, 유급이었던 만큼 연차를 돌려준다.
  for (const removedIds of chunked(
    removed.map((leave) => leave.id),
    BINDING_CHUNK_SIZE,
  )) {
    await db.delete(participantLeaves).where(inArray(participantLeaves.groupLeaveId, removedIds));
    await db.delete(groupLeaves).where(inArray(groupLeaves.id, removedIds));
  }
  const refunds = countByParticipantYear(
    removedRecords.filter((record) => record.leaveType === "PAID"),
  );
  for (const refund of refunds) {
    await db
      .update(participantAnnualLeave)
      .set({
        usedDays: sql`${participantAnnualLeave.usedDays} - ${refund.days}`,
        remainingDays: sql`${participantAnnualLeave.remainingDays} + ${refund.days}`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(participantAnnualLeave.participantId, refund.participantId),
          eq(participantAnnualLeave.year, refund.year),
        ),
      );
  }

  // 2) 새 날짜: 조 휴무를 만들고, 조원마다 그 날 하루짜리 개인 휴무를 연결해 만든다.
  const insertedLeaves = (
    await Promise.all(
      chunked(added, INSERT_ROW_CHUNK_SIZE).map((addedChunk) =>
        db
          .insert(groupLeaves)
          .values(
            addedChunk.map((leave) => ({
              groupId: id,
              date: leave.date,
              leaveType: leave.leaveType,
              createdBy: auth.id,
            })),
          )
          .returning(),
      ),
    )
  ).flat();

  const shortageKeys = new Set(
    shortages.map((shortage) => `${shortage.participantId}_${shortage.year}`),
  );
  const newRecords = insertedLeaves.flatMap((groupLeave) =>
    memberRows
      .filter(
        (member) =>
          groupLeave.leaveType === "UNPAID" ||
          !shortageKeys.has(`${member.id}_${yearOf(groupLeave.date)}`),
      )
      .map((member) => ({
        participantId: member.id,
        leaveStart: groupLeave.date,
        leaveEnd: groupLeave.date,
        leaveType: groupLeave.leaveType,
        leaveDays: 1,
        reason: "조 일괄 휴무",
        groupLeaveId: groupLeave.id,
        createdBy: auth.id,
      })),
  );
  for (const recordChunk of chunked(newRecords, INSERT_ROW_CHUNK_SIZE)) {
    await db.insert(participantLeaves).values(recordChunk);
  }

  const deductions = countByParticipantYear(
    newRecords
      .filter((record) => record.leaveType === "PAID")
      .map((record) => ({ participantId: record.participantId, date: record.leaveStart })),
  );
  for (const deduction of deductions) {
    await db
      .update(participantAnnualLeave)
      .set({
        usedDays: sql`${participantAnnualLeave.usedDays} + ${deduction.days}`,
        remainingDays: sql`${participantAnnualLeave.remainingDays} - ${deduction.days}`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(participantAnnualLeave.participantId, deduction.participantId),
          eq(participantAnnualLeave.year, deduction.year),
        ),
      );
  }

  // 오늘이 새로 휴무가 됐거나 풀렸을 수 있으니 출근 차단 상태를 다시 맞춘다.
  await syncLeaveStatus(db, getKstNow().date, { programId: found.program.id });

  const savedLeaves = await db
    .select({ date: groupLeaves.date, leaveType: groupLeaves.leaveType })
    .from(groupLeaves)
    .where(eq(groupLeaves.groupId, id))
    .orderBy(groupLeaves.date);

  return c.json({ groupId: id, leaves: savedLeaves, skipped: shortages });
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
