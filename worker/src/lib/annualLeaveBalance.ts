import { and, eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { participantAnnualLeave, participantLeaves, participants, programs } from "../db/schema";
import { computeAccruedLeaveDays, nextMonth } from "./capacityPayroll";
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
 * - 역량활용: 총 일수 = 그해 개근한 달 수(최대 10일, lib/capacityPayroll.ts), 사용 = 그해 날짜의
 *   유급휴가 기록 합. 관리자가 넣어둔 총 일수(participant_annual_leave)는 쓰지 않는다 — 처음에
 *   미리 10일씩 넣어뒀던 것을 버리고 개근한 달만큼만 인정하기로 했다(담당기관 확인).
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

  if (!isCapacityProgram(program)) {
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
    for (const participantId of participantIds) {
      const stored = storedByParticipant.get(participantId);
      balances.set(participantId, {
        participantId,
        year,
        totalDays: stored?.totalDays ?? 0,
        usedDays: stored?.usedDays ?? 0,
        remainingDays: stored?.remainingDays ?? 0,
        autoAccrued: false,
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
    const totalDays = accruedDays.get(participantId) ?? 0;
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
    });
  }
  return balances;
};
