import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, lte } from "drizzle-orm";

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

// 조가 배정된 근태만 대상으로 한다 — 조 미배정 참여자는 애초에 출근 시 근무시간
// 검증 자체를 건너뛰므로(clock-in 참고) 기준으로 삼을 근무종료시각이 없다.
export const autoClockOut = async (env: Env["Bindings"]): Promise<void> => {
  const db = drizzle(env.DB);
  const { date, time } = getKstNow();
  const nowMinutes = toMinutes(time);

  // 오늘 자정을 넘겨 크론이 못 돈 날짜의 근태(cron이 KST 18:00 이후 안 도는 사이 근무종료가
  // 지난 조 등)까지 다음 실행에서 놓치지 않도록 오늘 이전 날짜의 미마감 근태도 함께 본다 —
  // 지난 날짜는 이미 그 시각이 지났으니 무조건 마감 대상이다.
  const openLogs = await db
    .select({
      id: attendanceLogs.id,
      workDate: attendanceLogs.workDate,
      clockIn: attendanceLogs.clockIn,
      note: attendanceLogs.note,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
    })
    .from(attendanceLogs)
    .innerJoin(groups, eq(attendanceLogs.groupId, groups.id))
    .where(and(isNull(attendanceLogs.clockOut), lte(attendanceLogs.workDate, date)));

  for (const log of openLogs) {
    if (!log.clockIn) continue;

    const shiftEndMinutes = toMinutes(log.shiftEnd);
    const isPastDay = log.workDate < date;
    if (!isPastDay && nowMinutes < shiftEndMinutes + GRACE_MINUTES) continue;

    const clockOut = `${log.workDate}T${log.shiftEnd}:00.000Z`;
    const totalMinutes = Math.floor(
      (new Date(clockOut).getTime() - new Date(log.clockIn).getTime()) / 60000,
    );

    // 지각/조퇴 판정은 수동 퇴근(public.ts)과 동일한 규칙을 그대로 재사용한다.
    let status: "NORMAL" | "LATE" | "EARLY_LEAVE" = "NORMAL";
    let note: string | undefined;
    const expectedMinutes = shiftEndMinutes - toMinutes(log.shiftStart);
    const clockInMinutes = toMinutes(log.clockIn.slice(11, 16));
    if (totalMinutes < expectedMinutes - 10) {
      status = "EARLY_LEAVE";
      note = `조퇴 (예상: ${expectedMinutes}분, 실제: ${totalMinutes}분)`;
    } else if (clockInMinutes > toMinutes(log.shiftStart) + 10) {
      status = "LATE";
      note = `지각 (예상 시작: ${log.shiftStart})`;
    }

    // 마감 전에 이미 남아있던 메모(예: 관리자가 열려있는 동안 미리 남긴 메모)는 지우지 않고 이어붙인다.
    const noteParts = [log.note, note, "[자동퇴근]"].filter(Boolean);

    await db
      .update(attendanceLogs)
      .set({
        clockOut,
        totalMinutes,
        status,
        note: noteParts.join("\n"),
      })
      .where(eq(attendanceLogs.id, log.id));
  }
};
