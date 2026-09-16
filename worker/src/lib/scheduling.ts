import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import {
  demandSiteSchedules,
  groupMonthlySchedule,
  groups,
  groupShiftOverrides,
  participantGroupOverrides,
  participantMonthlySchedule,
  participants,
} from "../db/schema";

type DB = ReturnType<typeof drizzle>;

export interface GroupShift {
  shiftStart: string;
  shiftEnd: string;
}

// 그날 그 조가 실제로 근무하는 시간대 — 날짜별 근무시간(groupShiftOverrides)이 등록돼
// 있으면 그 값을, 없으면 조 기본값(groups.shiftStart/shiftEnd)을 쓴다. "이번주는 오전,
// 다음주는 오후"처럼 같은 조의 시간이 날짜마다 달라지는 편성이 여기로 들어온다.
// 조를 못 찾으면 null — 호출부는 지금까지 "조가 없으면 시간 검증을 건너뛴다"고 다루던
// 것과 같은 의미로 쓰면 된다.
// 출근/퇴근/자동퇴근/재난문자 대상 판정이 전부 이 함수를 거쳐야 "앱에는 13시 출근인데
// 자동퇴근은 12시에 걸린다" 같은 불일치가 안 생긴다. SQL 한 방으로 목록을 뽑아야 해서
// 이 함수를 못 쓰는 곳(scheduled/autoClockOut.ts, 관리자 출근부 목록)은 group_shift_overrides를
// leftJoin해서 COALESCE로 같은 우선순위를 직접 재현한다.
export const resolveGroupShift = async (
  db: DB,
  groupId: number,
  date: string,
): Promise<GroupShift | null> => {
  const [groupRows, overrideRows] = await Promise.all([
    db.select().from(groups).where(eq(groups.id, groupId)),
    db
      .select()
      .from(groupShiftOverrides)
      .where(and(eq(groupShiftOverrides.groupId, groupId), eq(groupShiftOverrides.date, date))),
  ]);

  const group = groupRows[0];
  if (!group) return null;

  const override = overrideRows[0];

  return {
    shiftStart: override?.shiftStart ?? group.shiftStart,
    shiftEnd: override?.shiftEnd ?? group.shiftEnd,
  };
};

// 특정 참여자가 지금(date, time) 실제로 근무 중이어야 하는지 판단한다.
// /attendance/clock-in의 조 임시배정(participantGroupOverrides) → 월간 근무일
// (참여자 개인 → 조 기본값) → 그날의 조 근무시간(resolveGroupShift) 판정을 그대로
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

  if (participant.demandSiteId) {
    const demandSiteScheduleRows = await db
      .select()
      .from(demandSiteSchedules)
      .where(
        and(
          eq(demandSiteSchedules.demandSiteId, participant.demandSiteId),
          eq(demandSiteSchedules.groupId, effectiveGroupId),
        ),
      );
    if (demandSiteScheduleRows.length === 0) return false;
  }

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

  const shift = await resolveGroupShift(db, effectiveGroupId, date);
  if (!shift) return false;

  return time >= shift.shiftStart && time <= shift.shiftEnd;
};
