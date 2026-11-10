import { and, eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { participantAnnualLeave, participantLeaves, participants, programs } from "../db/schema";
import {
  computeAccruedLeaveDays,
  MAX_ACCRUED_LEAVE_DAYS_PER_YEAR,
  nextMonth,
} from "./capacityPayroll";
import { getKstNow } from "./kst";

type DB = ReturnType<typeof drizzle>;
type Program = typeof programs.$inferSelect;
type Participant = typeof participants.$inferSelect;

// D1은 쿼리 하나에 바인딩 100개까지라 inArray를 이 크기로 쪼갠다.
const BINDING_CHUNK_SIZE = 90;

export interface AnnualLeaveBalance {
  participantId: number;
  year: string;
  totalDays: number;
  usedDays: number;
  // 역량활용은 그동안 쓴 연차가 개근한 달 수보다 많으면 0 아래로 내려갈 수 있다
  remainingDays: number;
  // true면 총 일수를 관리자가 정하지 않고 개근한 달 수로 계산한 것(역량활용)
  autoAccrued: boolean;
  // 역량활용: 총 일수 = min(도입 전 만근 일수 + 시스템 기록으로 센 만근 달 수, 10)
  preSystemAccruedDays: number;
  accruedDays: number;
}

export const isCapacityProgram = (program: Pick<Program, "programType">) =>
  program.programType === "역량 활용";

const chunked = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

/**
 * 참여자들의 그해 연차 현황.
 *
 * - 역량활용: 총 일수 = 도입 전 만근 일수(관리자 입력) + 그해 시스템 기록으로 센 개근 달 수,
 *   최대 10일(lib/capacityPayroll.ts). 사용 = 그해 날짜의 유급휴가 기록 합. 관리자가 넣어둔 총
 *   일수(participant_annual_leave.totalDays)는 쓰지 않는다 — 처음에 미리 10일씩 넣어뒀던 것을
 *   버리고 개근한 달만큼만 인정하기로 했다(담당기관 확인). 시스템 도입 전 달은 출퇴근 기록이
 *   없어 셀 수 없으므로 그만큼은 관리자가 따로 넣는다.
 * - 그 외(공익활동): 관리자가 정한 값(participant_annual_leave)을 그대로 쓴다.
 *
 * throughMonth를 주면 그 달까지(그 달 포함) 개근을 센다 — 계약 종료 달의 미사용 연차 정산은
 * 그 달이 끝나기 전에 급여를 계산하므로, 진행 중인 마지막 달도 개근이면 세야 한다. 안 주면
 * 이미 끝난 달만 센다.
 */
export const getAnnualLeaveBalances = async (
  db: DB,
  program: Program,
  participantList: Participant[],
  year: string,
  { throughMonth }: { throughMonth?: string } = {},
): Promise<Map<number, AnnualLeaveBalance>> => {
  const balances = new Map<number, AnnualLeaveBalance>();
  if (participantList.length === 0) return balances;
  const participantIds = participantList.map((participant) => participant.id);

  const storedRows = (
    await Promise.all(
      chunked(participantIds, BINDING_CHUNK_SIZE).map((ids) =>
        db
          .select()
          .from(participantAnnualLeave)
          .where(
            and(
              inArray(participantAnnualLeave.participantId, ids),
              eq(participantAnnualLeave.year, year),
            ),
          ),
      ),
    )
  ).flat();
  const storedByParticipant = new Map(storedRows.map((row) => [row.participantId, row]));

  if (!isCapacityProgram(program)) {
    for (const participantId of participantIds) {
      const stored = storedByParticipant.get(participantId);
      balances.set(participantId, {
        participantId,
        year,
        totalDays: stored?.totalDays ?? 0,
        usedDays: stored?.usedDays ?? 0,
        remainingDays: stored?.remainingDays ?? 0,
        autoAccrued: false,
        preSystemAccruedDays: 0,
        accruedDays: 0,
      });
    }
    return balances;
  }

  const [accruedDays, paidLeaveRows] = await Promise.all([
    computeAccruedLeaveDays(
      db,
      program,
      year,
      throughMonth ? nextMonth(throughMonth) : getKstNow().date.slice(0, 7),
      participantList,
    ),
    Promise.all(
      chunked(participantIds, BINDING_CHUNK_SIZE).map((ids) =>
        db
          .select({
            participantId: participantLeaves.participantId,
            leaveDays: participantLeaves.leaveDays,
          })
          .from(participantLeaves)
          .where(
            and(
              inArray(participantLeaves.participantId, ids),
              eq(participantLeaves.leaveType, "PAID"),
              like(participantLeaves.leaveStart, `${year}-%`),
            ),
          ),
      ),
    ).then((rows) => rows.flat()),
  ]);

  for (const participantId of participantIds) {
    const preSystemAccruedDays = storedByParticipant.get(participantId)?.preSystemAccruedDays ?? 0;
    const systemAccruedDays = accruedDays.get(participantId) ?? 0;
    const totalDays = Math.min(
      preSystemAccruedDays + systemAccruedDays,
      MAX_ACCRUED_LEAVE_DAYS_PER_YEAR,
    );
    const usedDays = paidLeaveRows
      .filter((row) => row.participantId === participantId)
      .reduce((sum, row) => sum + row.leaveDays, 0);
    balances.set(participantId, {
      participantId,
      year,
      totalDays,
      usedDays,
      remainingDays: totalDays - usedDays,
      autoAccrued: true,
      preSystemAccruedDays,
      accruedDays: systemAccruedDays,
    });
  }
  return balances;
};

/**
 * 역량활용 참여자들의 그해 "도입 전 만근 일수"를 저장한다. 연차 행이 없으면 만든다 — 총/사용/잔여
 * 열은 역량활용에선 쓰지 않으므로(볼 때마다 계산) 새 행은 0으로 둔다.
 */
export const savePreSystemAccruedDays = async (
  db: DB,
  participantIds: number[],
  year: string,
  preSystemAccruedDays: number,
): Promise<void> => {
  if (participantIds.length === 0) return;
  const now = new Date().toISOString();
  const statements = participantIds.map((participantId) =>
    db
      .insert(participantAnnualLeave)
      .values({ participantId, year, preSystemAccruedDays })
      .onConflictDoUpdate({
        target: [participantAnnualLeave.participantId, participantAnnualLeave.year],
        set: { preSystemAccruedDays, updatedAt: now },
      }),
  );
  const [firstStatement, ...restStatements] = statements;
  await db.batch([firstStatement, ...restStatements]);
};

// 도입 전 만근 일수 입력값 검증 — 0~10 정수
export const validatePreSystemAccruedDays = (value: unknown): string | null =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= MAX_ACCRUED_LEAVE_DAYS_PER_YEAR
    ? null
    : `도입 전 만근 일수는 0~${MAX_ACCRUED_LEAVE_DAYS_PER_YEAR} 사이 정수로 입력해주세요.`;
