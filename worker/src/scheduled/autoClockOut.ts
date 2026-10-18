import { and, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import {
  attendanceLogs,
  groups,
  groupShiftOverrides,
  participantEscapeMeta,
  participants,
} from "../db/schema";
import { checkPositionAgainstDemandSite } from "../lib/geofence";
import { getKstNow } from "../lib/kst";
import type { Env } from "../types";

// 조 근무종료시각을 지나고도 퇴근 버튼을 안 누르면 이 여유(분)까지만 기다린 뒤 자동 마감을
// "시도"한다(마감 자체는 아래 위치 확인을 통과해야 실제로 일어난다). clockOut은 실제
// 처리 시각이 아니라 조 근무종료시각으로 채운다 — 급여로 인정되는 시간은 항상 정규
// 종료시각 기준이다.
const GRACE_MINUTES = 10;

// 참여자 앱은 근무 중 10분 주기로 위치를 보고한다(locationReporting.ts). 이보다 오래된
// 마지막 위치는 "지금도 그 자리에 있다"는 근거로 못 쓴다 — checkSignalLoss.ts의 통신
// 끊김 알림 기준(25분)보다 살짝 넉넉하게 잡아서, 신호가 막 끊긴 직후까지 성급하게
// 위치확인불가로 몰지 않는다.
const FRESHNESS_MINUTES = 30;

// "HH:MM" -> 자정 기준 분
const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

// 자정 기준 분 -> "HH:MM" (크론이 KST 09:00~18:15에만 돌아서 자정을 넘길 일이 없다)
const toHHMM = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// 마지막 위치(participant_escape_meta)는 근무 건이 아니라 참여자당 하나라서, 다음 날
// 출근해 보고한 위치로 갱신되면 전날 열려있던 근무까지 "지금 위치"로 판정하게 된다 —
// 그러면 전날 이탈 의심/위치 확인 불가로 보류된 근무가 오늘 근무지에 있다는 이유로 정규
// 종료시각 마감이 돼버린다. 그래서 지난 날짜 근무는 지금 기준 신선도가 아니라 "그날
// 근무종료 무렵(종료 FRESHNESS_MINUTES 전 ~ 그날 자정 전)에 받은 위치"일 때만 쓴다.
// lastLocationAt과 아래 경계값은 둘 다 KST 벽시계 시각에 Z를 붙인 형식이라 문자열로 비교한다.
const isLocationUsableFor = (
  log: { workDate: string; shiftEnd: string; lastLocationAt: string | null },
  today: string,
  staleBefore: string,
): boolean => {
  if (!log.lastLocationAt) return false;
  if (log.workDate === today) return log.lastLocationAt >= staleBefore;

  const windowStart = `${log.workDate}T${toHHMM(Math.max(0, toMinutes(log.shiftEnd) - FRESHNESS_MINUTES))}:00.000Z`;
  return log.lastLocationAt.slice(0, 10) === log.workDate && log.lastLocationAt >= windowStart;
};

// 조가 배정된 근무만 대상으로 한다 — 조 미배정 참여자는 애초에 출근 시 근무시간
// 검증 자체를 건너뛰므로(clock-in 참고) 기준으로 삼을 근무종료시각이 없다.
export const autoClockOut = async (env: Env["Bindings"]): Promise<void> => {
  const db = drizzle(env.DB);
  const { date, time, iso } = getKstNow();
  const nowMinutes = toMinutes(time);
  const cutoffShiftEnd = toHHMM(nowMinutes - GRACE_MINUTES);
  const staleBefore = new Date(Date.parse(iso) - FRESHNESS_MINUTES * 60 * 1000).toISOString();

  // 매분 "아직 안 마감된 근무 전체"를 다 읽어온 뒤 JS에서 거르면, 근무 중인 인원이 많아질수록
  // 매분 그 인원 전체를 읽게 된다 — 실제로 이번 분에 마감 대상인 것만 SQL에서 걸러낸다.
  // 오늘 이전 날짜(cron이 KST 18:00 이후 안 도는 사이 놓친 것)는 시각과 무관하게 무조건
  // 대상이고, 오늘 날짜는 조 근무종료 + 여유(GRACE_MINUTES)가 지난 조만 대상이다.

  // 그날 근무종료시각 — 날짜별 근무시간(group_shift_overrides)이 등록된 날은 그 값이,
  // 없으면 조 기본값이 기준이다. 목록을 SQL 한 방으로 뽑아야 해서 resolveGroupShift를
  // 못 쓰는 대신 여기서 같은 우선순위를 COALESCE로 재현한다 — 둘이 갈라지면 참여자
  // 앱은 13시 퇴근인데 자동퇴근은 12시에 걸어버리는 식으로 어긋난다.
  const effectiveShiftEnd = sql<string>`COALESCE(${groupShiftOverrides.shiftEnd}, ${groups.shiftEnd})`;

  const openLogs = await db
    .select({
      id: attendanceLogs.id,
      workDate: attendanceLogs.workDate,
      clockIn: attendanceLogs.clockIn,
      note: attendanceLogs.note,
      shiftEnd: effectiveShiftEnd,
      demandSiteId: participants.demandSiteId,
      lastLat: participantEscapeMeta.lastLat,
      lastLng: participantEscapeMeta.lastLng,
      lastLocationAt: participantEscapeMeta.lastLocationAt,
    })
    .from(attendanceLogs)
    .innerJoin(groups, eq(attendanceLogs.groupId, groups.id))
    .innerJoin(participants, eq(attendanceLogs.participantId, participants.id))
    .leftJoin(
      groupShiftOverrides,
      and(
        eq(groupShiftOverrides.groupId, attendanceLogs.groupId),
        eq(groupShiftOverrides.date, attendanceLogs.workDate),
      ),
    )
    .leftJoin(
      participantEscapeMeta,
      eq(attendanceLogs.participantId, participantEscapeMeta.participantId),
    )
    .where(
      and(
        isNull(attendanceLogs.clockOut),
        lte(attendanceLogs.workDate, date),
        or(lt(attendanceLogs.workDate, date), lte(effectiveShiftEnd, cutoffShiftEnd)),
      ),
    );

  for (const log of openLogs) {
    if (!log.clockIn) continue;

    // 위치 신호가 오래됐거나(신호 끊김) 아예 없으면 "지금도 그 자리에 있었다"고 볼 근거가
    // 없다 — 자동 마감을 보류하고 사유만 남긴다. 오늘 근무는 다음 분 재평가 때 새 위치가
    // 들어와 신선해지면 그때 정상적으로 마감되고, 지난 날짜 근무는 관리자가 직접 처리한다.
    if (!isLocationUsableFor(log, date, staleBefore)) {
      await db
        .update(attendanceLogs)
        .set({ clockOutReviewReason: "LOCATION_UNKNOWN" })
        .where(eq(attendanceLogs.id, log.id));
      continue;
    }

    const position = await checkPositionAgainstDemandSite(
      db,
      log.demandSiteId,
      log.lastLat,
      log.lastLng,
    );

    // 명확히 구역 밖(false)일 때만 보류한다 — 관제구역이 아직 등록 안 돼 판정 자체가
    // 안 되는 경우(null)는 비교 대상이 없으니 그대로 마감을 진행한다.
    if (position.inside === false) {
      await db
        .update(attendanceLogs)
        .set({ clockOutReviewReason: "OUTSIDE_AREA" })
        .where(eq(attendanceLogs.id, log.id));
      continue;
    }

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
        clockOutReviewReason: null,
        clockOutLat: log.lastLat,
        clockOutLng: log.lastLng,
        clockOutInside: position.inside,
        clockOutDistanceM: position.distanceM,
      })
      .where(eq(attendanceLogs.id, log.id));
  }
};
