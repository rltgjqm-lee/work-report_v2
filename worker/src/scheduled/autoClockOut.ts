import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, lt, lte, or } from "drizzle-orm";

import { attendanceLogs, groups } from "../db/schema";
import { getKstNow } from "../lib/kst";
import type { Env } from "../types";

// 조 근무종료시각을 지나고도 퇴근 버튼을 안 누르면 이 여유(분)까지만 기다린 뒤 자동 마감한다.
// clockOut은 실제 처리 시각이 아니라 조 근무종료시각으로 채운다 — 이 여유는 "정말 안
// 눌렀는지" 확인하는 용도일 뿐, 급여로 인정되는 시간은 항상 정규 종료시각 기준이다.
const GRACE_MINUTES = 10;

// "HH:MM" -> 자정 기준 분
const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

// 자정 기준 분 -> "HH:MM" (크론이 KST 09:00~18:00에만 돌아서 자정을 넘길 일이 없다)
const toHHMM = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// 조가 배정된 근무만 대상으로 한다 — 조 미배정 참여자는 애초에 출근 시 근무시간
// 검증 자체를 건너뛰므로(clock-in 참고) 기준으로 삼을 근무종료시각이 없다.
export const autoClockOut = async (env: Env["Bindings"]): Promise<void> => {
  const db = drizzle(env.DB);
  const { date, time } = getKstNow();
  const nowMinutes = toMinutes(time);
  const cutoffShiftEnd = toHHMM(nowMinutes - GRACE_MINUTES);

  // 매분 "아직 안 마감된 근무 전체"를 다 읽어온 뒤 JS에서 거르면, 근무 중인 인원이 많아질수록
  // 매분 그 인원 전체를 읽게 된다 — 실제로 이번 분에 마감 대상인 것만 SQL에서 걸러낸다.
  // 오늘 이전 날짜(cron이 KST 18:00 이후 안 도는 사이 놓친 것)는 시각과 무관하게 무조건
  // 대상이고, 오늘 날짜는 조 근무종료 + 여유(GRACE_MINUTES)가 지난 조만 대상이다.
  const openLogs = await db
    .select({
      id: attendanceLogs.id,
      workDate: attendanceLogs.workDate,
      clockIn: attendanceLogs.clockIn,
      note: attendanceLogs.note,
      shiftEnd: groups.shiftEnd,
    })
    .from(attendanceLogs)
    .innerJoin(groups, eq(attendanceLogs.groupId, groups.id))
    .where(
      and(
        isNull(attendanceLogs.clockOut),
        lte(attendanceLogs.workDate, date),
        or(lt(attendanceLogs.workDate, date), lte(groups.shiftEnd, cutoffShiftEnd)),
      ),
    );

  for (const log of openLogs) {
    if (!log.clockIn) continue;

    const clockOut = `${log.workDate}T${log.shiftEnd}:00.000Z`;
    const totalMinutes = Math.floor(
      (new Date(clockOut).getTime() - new Date(log.clockIn).getTime()) / 60000,
    );

    // 마감 전에 이미 남아있던 메모(예: 관리자가 열려있는 동안 미리 남긴 메모)는 지우지 않고 이어붙인다.
    const noteParts = [log.note, "[자동퇴근]"].filter(Boolean);

    await db
      .update(attendanceLogs)
      .set({
        clockOut,
        totalMinutes,
        status: "NORMAL",
        note: noteParts.join("\n"),
      })
      .where(eq(attendanceLogs.id, log.id));
  }
};
