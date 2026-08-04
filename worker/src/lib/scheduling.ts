import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import {
  participants,
  participantGroupOverrides,
  participantMonthlySchedule,
  groupMonthlySchedule,
  groups,
} from "../db/schema";

type DB = ReturnType<typeof drizzle>;

// 특정 참여자가 지금(date, time) 실제로 근무 중이어야 하는지 판단한다.
// /attendance/clock-in의 조 임시배정(participantGroupOverrides) → 월간 스케줄
// (참여자 개인 → 조 기본값) → 조 근무시간(groups.shiftStart/shiftEnd) 판정을 그대로
// 재사용한다 — 재난문자 대상 선정처럼 읽기 전용으로만 쓰는 곳에서 이 규칙이 갈라지면
// "출근 가능한 시간인데 알림은 안 온다" 같은 불일치가 생기기 때문.
export const isParticipantScheduledNow = async (
  db: DB,
  participantId: number,
  date: string,
  time: string,
): Promise<boolean> => {
  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));
  const participant = participantRows[0];
  if (!participant) return false;

  if (participant.status === "DROPPED") return false;
  // clock-in은 leaveEnd가 지나면 자동으로 ACTIVE로 되돌리지만(DB를 갱신), 여기서는
  // 읽기 전용이라 그 갱신 없이 "leaveEnd가 지났으면 이미 복귀한 것"으로만 판단한다.
  if (
    participant.status === "ON_LEAVE" &&
    (!participant.leaveEnd || participant.leaveEnd >= date)
  ) {
    return false;
  }

  const overrideRows = await db
    .select()
    .from(participantGroupOverrides)
    .where(
      and(
        eq(participantGroupOverrides.participantId, participantId),
        eq(participantGroupOverrides.date, date),
      ),
    );
  const effectiveGroupId = overrideRows[0]?.groupId ?? participant.groupId;
  if (!effectiveGroupId) return false;

  const yearMonth = date.slice(0, 7);
  const participantScheduleRows = await db
    .select()
    .from(participantMonthlySchedule)
    .where(
      and(
        eq(participantMonthlySchedule.participantId, participantId),
        eq(participantMonthlySchedule.yearMonth, yearMonth),
      ),
    );

  let workDates: string[] | null = participantScheduleRows[0]
    ? (JSON.parse(participantScheduleRows[0].workDates) as string[])
    : null;

  if (!workDates) {
    const groupScheduleRows = await db
      .select()
      .from(groupMonthlySchedule)
      .where(
        and(
          eq(groupMonthlySchedule.groupId, effectiveGroupId),
          eq(groupMonthlySchedule.yearMonth, yearMonth),
        ),
      );
    workDates = groupScheduleRows[0]
      ? (JSON.parse(groupScheduleRows[0].workDates) as string[])
      : null;
  }

  if (workDates && !workDates.includes(date)) return false;

  const groupRows = await db.select().from(groups).where(eq(groups.id, effectiveGroupId));
  const group = groupRows[0];
  if (!group) return false;

  return time >= group.shiftStart && time <= group.shiftEnd;
};
