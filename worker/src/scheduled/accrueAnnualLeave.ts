import { and, eq, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import {
  participantAnnualLeave,
  participantLeaveAccruals,
  participants,
  programs,
} from "../db/schema";
import {
  computeCapacityPayrollMonth,
  MAX_ACCRUED_LEAVE_DAYS_PER_YEAR,
  MONTHLY_STANDARD_HOURS,
} from "../lib/capacityPayroll";
import { getKstNow } from "../lib/kst";
import type { Env } from "../types";

type DB = ReturnType<typeof drizzle>;

// D1은 쿼리 하나당 바인딩 100개 제한이 있어 한 번에 넣는 행 수를 나눈다(행당 4개).
const INSERT_CHUNK_SIZE = 20;

const nextMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 12
    ? `${year + 1}-01`
    : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
};

// 사업단 시작 월부터 지난달까지(사업단 종료 월 이후는 제외) — 끝난 달만 판정한다.
const listCompletedMonths = (program: typeof programs.$inferSelect, currentMonth: string) => {
  const lastMonth = program.endDate.slice(0, 7) < currentMonth ? program.endDate.slice(0, 7) : null;
  const months: string[] = [];
  for (
    let month = program.startDate.slice(0, 7);
    month < currentMonth && (!lastMonth || month <= lastMonth);
    month = nextMonth(month)
  ) {
    months.push(month);
  }
  return months;
};

const accrueProgramMonth = async (
  db: DB,
  program: typeof programs.$inferSelect,
  month: string,
  programParticipants: (typeof participants.$inferSelect)[],
) => {
  const evaluatedRows = await db
    .select({ participantId: participantLeaveAccruals.participantId })
    .from(participantLeaveAccruals)
    .innerJoin(participants, eq(participantLeaveAccruals.participantId, participants.id))
    .where(
      and(eq(participants.programId, program.id), eq(participantLeaveAccruals.yearMonth, month)),
    );
  const evaluatedParticipantIds = new Set(evaluatedRows.map((row) => row.participantId));
  const participantsToEvaluate = programParticipants.filter(
    (participant) => !evaluatedParticipantIds.has(participant.id),
  );
  if (participantsToEvaluate.length === 0) return;

  const payrollByParticipant = await computeCapacityPayrollMonth(
    db,
    program,
    month,
    participantsToEvaluate,
  );
  const year = month.slice(0, 4);

  // 올해 이미 적립된 개근 연차 일수 — 최대 10일 제한용
  const accruedCountRows = await db
    .select({
      participantId: participantLeaveAccruals.participantId,
      accruedDays: sql<number>`COUNT(*)`,
    })
    .from(participantLeaveAccruals)
    .innerJoin(participants, eq(participantLeaveAccruals.participantId, participants.id))
    .where(
      and(
        eq(participants.programId, program.id),
        eq(participantLeaveAccruals.accrued, true),
        like(participantLeaveAccruals.yearMonth, `${year}-%`),
      ),
    )
    .groupBy(participantLeaveAccruals.participantId);
  const accruedDaysByParticipant = new Map(
    accruedCountRows.map((row) => [row.participantId, row.accruedDays]),
  );

  const accrualRows = participantsToEvaluate.map((participant) => {
    const recognizedHours = payrollByParticipant.get(participant.id)?.recognizedHours ?? 0;
    const accrued =
      recognizedHours >= MONTHLY_STANDARD_HOURS &&
      (accruedDaysByParticipant.get(participant.id) ?? 0) < MAX_ACCRUED_LEAVE_DAYS_PER_YEAR;
    return { participantId: participant.id, yearMonth: month, recognizedHours, accrued };
  });

  // 판정 기록과 연차 증가를 한 batch(트랜잭션)로 묶는다 — 중간에 실패하면 둘 다 없던 일이
  // 되어 다음 날 같은 달을 다시 판정하고, 기록만 남고 연차가 안 쌓이는 일이 없다.
  const insertStatements = [];
  for (let index = 0; index < accrualRows.length; index += INSERT_CHUNK_SIZE) {
    insertStatements.push(
      db
        .insert(participantLeaveAccruals)
        .values(accrualRows.slice(index, index + INSERT_CHUNK_SIZE))
        .onConflictDoNothing(),
    );
  }
  const upsertStatements = accrualRows
    .filter((accrualRow) => accrualRow.accrued)
    .map((accrualRow) =>
      db
        .insert(participantAnnualLeave)
        .values({
          participantId: accrualRow.participantId,
          year,
          totalDays: 1,
          usedDays: 0,
          remainingDays: 1,
        })
        .onConflictDoUpdate({
          target: [participantAnnualLeave.participantId, participantAnnualLeave.year],
          set: {
            totalDays: sql`${participantAnnualLeave.totalDays} + 1`,
            remainingDays: sql`${participantAnnualLeave.remainingDays} + 1`,
            updatedAt: new Date().toISOString(),
          },
        }),
    );
  const [firstStatement, ...restStatements] = [...insertStatements, ...upsertStatements];
  await db.batch([firstStatement, ...restStatements]);
};

// 역량활용 월 개근 연차 자동 적립 — 지난달(1일~말일) 인정 근로시간(유급·교육·공휴일 유급
// 포함)이 60시간이면 연차 1일(3시간)을 더한다. 하루 한 번(KST 18:00) 돌면서 아직 판정하지
// 않은 끝난 달을 전부 처리하므로, 처음 배포될 때 사업단 시작 월부터 소급 적립되고 이후엔
// 새로 끝난 달만 처리한다. 판정 기록(participant_leave_accruals)이 있는 달은 다시 보지
// 않는다 — 판정 뒤에 그달 출퇴근 기록을 고쳐도 적립이 소급 변경되지는 않는다.
// ⚠️ 아직 cron(index.ts)에 연결하지 않았다 — 기존 참여자 연차가 수동으로 10일씩 미리 들어가
// 있어, 그대로 켜면 소급 적립분이 그 위에 더해진다. 처리 방식이 정해지면 DAILY_CRON에 붙인다.
export const accrueAnnualLeave = async (env: Env["Bindings"]): Promise<void> => {
  const db = drizzle(env.DB);
  const currentMonth = getKstNow().date.slice(0, 7);

  const capacityPrograms = await db
    .select()
    .from(programs)
    .where(eq(programs.programType, "역량 활용"));

  for (const program of capacityPrograms) {
    const months = listCompletedMonths(program, currentMonth);
    if (months.length === 0) continue;

    const programParticipants = await db
      .select()
      .from(participants)
      .where(eq(participants.programId, program.id));
    if (programParticipants.length === 0) continue;

    for (const month of months) {
      await accrueProgramMonth(db, program, month, programParticipants);
    }
  }
};
