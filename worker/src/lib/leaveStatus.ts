import { and, eq, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { participantLeaves, participants } from "../db/schema";

type DB = ReturnType<typeof drizzle>;

// 한 명만 맞추거나(출근), 사업단 전체를 맞추거나(본인확인·일괄 휴무 등록), 생략하면 전체.
// 참여자 id 목록을 inArray로 받으면 D1 바인딩 제한(100)에 걸려서 사업단 단위로 받는다.
export type LeaveStatusScope = { participantId: number } | { programId: number };

/**
 * participants.status의 ON_LEAVE와 leaveStart/leaveEnd를 휴무 이력(participant_leaves)에
 * 맞춘다 — date가 어떤 휴무 기간 안에 들어가면 ON_LEAVE(그 기간), 아니면 ACTIVE.
 * 탈락(DROPPED)은 건드리지 않는다.
 *
 * 예전엔 휴무를 등록하는 순간 status를 ON_LEAVE로 바꿨는데, 시작일이 미래인 휴무를 미리
 * 넣으면 그날부터가 아니라 등록한 순간부터 출근이 막혔고, 참여자 row에 기간이 하나만
 * 들어가서 띄엄띄엄 있는 휴무 여러 건을 담을 수 없었다. 이제 기간의 원본은 이력이고
 * status는 "오늘 휴무 중인가"를 빨리 읽기 위한 캐시다 — 휴무 등록/복귀 처리 직후,
 * 스케줄러, 출근·본인확인 직전에 이 함수로 다시 맞춘다.
 */
export const syncLeaveStatus = async (
  db: DB,
  date: string,
  scope?: LeaveStatusScope,
): Promise<void> => {
  // 기간이 겹치게 등록돼 있으면 가장 늦게 끝나는 휴무를 현재 휴무로 본다.
  const coveringLeave = sql`FROM ${participantLeaves}
    WHERE ${participantLeaves.participantId} = ${participants.id}
      AND ${participantLeaves.leaveStart} <= ${date}
      AND ${participantLeaves.leaveEnd} >= ${date}
    ORDER BY ${participantLeaves.leaveEnd} DESC
    LIMIT 1`;

  const scopeCondition = !scope
    ? undefined
    : "participantId" in scope
      ? eq(participants.id, scope.participantId)
      : eq(participants.programId, scope.programId);

  await db
    .update(participants)
    .set({ status: "ACTIVE", leaveStart: null, leaveEnd: null })
    .where(
      and(
        eq(participants.status, "ON_LEAVE"),
        sql`NOT EXISTS (SELECT 1 ${coveringLeave})`,
        scopeCondition,
      ),
    );

  await db
    .update(participants)
    .set({
      status: "ON_LEAVE",
      leaveStart: sql`(SELECT ${participantLeaves.leaveStart} ${coveringLeave})`,
      leaveEnd: sql`(SELECT ${participantLeaves.leaveEnd} ${coveringLeave})`,
    })
    .where(
      and(
        ne(participants.status, "DROPPED"),
        sql`EXISTS (SELECT 1 ${coveringLeave})`,
        scopeCondition,
      ),
    );
};
