import { and, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import {
  attendanceLogs,
  groupMonthlySchedule,
  groups,
  groupShiftOverrides,
  participantLeaves,
  participantMonthlySchedule,
  participants,
  participantTrainingLogs,
  programs,
} from "../db/schema";
import { getHolidayName } from "./koreanHolidays";

type DB = ReturnType<typeof drizzle>;
type Program = typeof programs.$inferSelect;
type Participant = typeof participants.$inferSelect;

// 2026년 노인역량활용사업 임금산정 기준(근로계약서 제4~6조, 첨부1) 중 시스템이 자동으로
// 계산하는 부분을 모아둔다. 급여대장·급여명세서 엑셀과 월 개근 연차 잔여가 모두 이
// 계산을 거쳐야 "엑셀엔 개근인데 연차는 안 쌓였다" 같은 불일치가 안 생긴다.

// 월 소정근로시간 — 평일 공휴일·노동절 포함 매월 1일~말일 60시간(20일 × 3시간)
export const MONTHLY_STANDARD_HOURS = 60;
// 1일 소정근로시간 — 평일 공휴일 유급, 연차 1일, 미사용 연차 정산의 시간 단위
export const DAILY_STANDARD_HOURS = 3;
// 월 개근 연차는 최대 10일(30시간)까지만 생긴다
export const MAX_ACCRUED_LEAVE_DAYS_PER_YEAR = 10;

// 주휴수당 구간 — 월 근로시간(유급 포함 인정 근로시간) 기준
// 15h 미만 0 / 15h~ 3h / 30h~ 6h / 45h~ 9h / 60h(개근) 12h
export const toWeeklyHolidayHours = (recognizedHours: number): number => {
  if (recognizedHours >= 60) return 12;
  if (recognizedHours >= 45) return 9;
  if (recognizedHours >= 30) return 6;
  if (recognizedHours >= 15) return 3;
  return 0;
};

export interface CapacityPayrollMonth {
  // 실제 출퇴근 기록 시간 합 — 기본급 계산의 근무시간 열
  actualWorkHours: number;
  // 출근한 날을 그날 소정근로시간 전체로 인정한 합 — 지각·조퇴가 있어도 그 소정근로일에
  // 출근했다면 주휴수당·연차 발생에는 영향이 없다는 기준을 그대로 옮긴 것
  attendedScheduledHours: number;
  paidLeaveHours: number;
  trainingHours: number;
  // 평일 공휴일(대체공휴일·노동절 포함) × 3시간 — 그 공휴일 당시 재직자에 한함
  holidayPaidHours: number;
  // 주휴 구간·만근·연차 발생 판단 기준 = 출근 인정 + 유급휴가 + 교육 + 공휴일 유급
  recognizedHours: number;
  weeklyHolidayHours: number;
}

const toMinutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

export const listMonthDates = (month: string): string[] => {
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return Array.from(
    { length: daysInMonth },
    (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
  );
};

const isWeekday = (date: string) => {
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
};

// 그 공휴일 당시 재직자였는지 — 입사일(없으면 사업단 시작일) 이후이고, 사업단 종료일·참여
// 종료일 이전이어야 한다. droppedAt은 ISO 시각이라 날짜 부분만 비교한다.
const isEmployedOn = (participant: Participant, program: Program, date: string) => {
  const employedFrom = participant.hireDate ?? program.startDate;
  if (date < employedFrom || date > program.endDate) return false;
  if (participant.status === "DROPPED" && participant.droppedAt) {
    return date < participant.droppedAt.slice(0, 10);
  }
  return true;
};

// 사업단 한 곳의 기간 내 계산 재료 — 한 번 읽어두고 여러 달을 계산할 수 있게 달 단위가 아니라
// 기간 단위로 읽는다(연차 잔여는 그해 끝난 달 전부를 봐야 해서 달마다 다시 읽으면 쿼리가 너무 많다).
interface CapacityPayrollData {
  groupById: Map<number, typeof groups.$inferSelect>;
  // key: `${groupId}_${yearMonth}`
  groupWorkDates: Map<string, string[]>;
  // key: `${participantId}_${yearMonth}`
  participantWorkDates: Map<string, string[]>;
  shiftOverrideByGroupDate: Map<string, typeof groupShiftOverrides.$inferSelect>;
  attendanceByParticipantDate: Map<string, typeof attendanceLogs.$inferSelect>;
  paidLeaveRows: (typeof participantLeaves.$inferSelect)[];
  trainingRows: (typeof participantTrainingLogs.$inferSelect)[];
}

const loadCapacityPayrollData = async (
  db: DB,
  program: Program,
  firstMonth: string,
  lastMonth: string,
): Promise<CapacityPayrollData> => {
  const rangeStart = `${firstMonth}-01`;
  const lastMonthDates = listMonthDates(lastMonth);
  const rangeEnd = lastMonthDates[lastMonthDates.length - 1];

  const [
    groupRows,
    groupScheduleRows,
    participantScheduleRows,
    shiftOverrideRows,
    attendanceRows,
    paidLeaveRows,
    trainingRows,
  ] = await Promise.all([
    db.select().from(groups).where(eq(groups.programId, program.id)),
    db
      .select({ schedule: groupMonthlySchedule })
      .from(groupMonthlySchedule)
      .innerJoin(groups, eq(groupMonthlySchedule.groupId, groups.id))
      .where(
        and(
          eq(groups.programId, program.id),
          gte(groupMonthlySchedule.yearMonth, firstMonth),
          lte(groupMonthlySchedule.yearMonth, lastMonth),
        ),
      )
      .then((rows) => rows.map((row) => row.schedule)),
    db
      .select({ schedule: participantMonthlySchedule })
      .from(participantMonthlySchedule)
      .innerJoin(participants, eq(participantMonthlySchedule.participantId, participants.id))
      .where(
        and(
          eq(participants.programId, program.id),
          gte(participantMonthlySchedule.yearMonth, firstMonth),
          lte(participantMonthlySchedule.yearMonth, lastMonth),
        ),
      )
      .then((rows) => rows.map((row) => row.schedule)),
    db
      .select({ override: groupShiftOverrides })
      .from(groupShiftOverrides)
      .innerJoin(groups, eq(groupShiftOverrides.groupId, groups.id))
      .where(
        and(
          eq(groups.programId, program.id),
          gte(groupShiftOverrides.date, rangeStart),
          lte(groupShiftOverrides.date, rangeEnd),
        ),
      )
      .then((rows) => rows.map((row) => row.override)),
    db
      .select()
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.programId, program.id),
          gte(attendanceLogs.workDate, rangeStart),
          lte(attendanceLogs.workDate, rangeEnd),
        ),
      ),
    db
      .select({ leave: participantLeaves })
      .from(participantLeaves)
      .innerJoin(participants, eq(participantLeaves.participantId, participants.id))
      .where(
        and(
          eq(participants.programId, program.id),
          eq(participantLeaves.leaveType, "PAID"),
          lte(participantLeaves.leaveStart, rangeEnd),
          gte(participantLeaves.leaveEnd, rangeStart),
        ),
      )
      .then((rows) => rows.map((row) => row.leave)),
    db
      .select({ log: participantTrainingLogs })
      .from(participantTrainingLogs)
      .innerJoin(participants, eq(participantTrainingLogs.participantId, participants.id))
      .where(
        and(
          eq(participants.programId, program.id),
          eq(participantTrainingLogs.status, "COMPLETED"),
          gte(participantTrainingLogs.attendDate, rangeStart),
          lte(participantTrainingLogs.attendDate, rangeEnd),
        ),
      )
      .then((rows) => rows.map((row) => row.log)),
  ]);

  return {
    groupById: new Map(groupRows.map((group) => [group.id, group])),
    groupWorkDates: new Map(
      groupScheduleRows.map((schedule) => [
        `${schedule.groupId}_${schedule.yearMonth}`,
        JSON.parse(schedule.workDates) as string[],
      ]),
    ),
    participantWorkDates: new Map(
      participantScheduleRows.map((schedule) => [
        `${schedule.participantId}_${schedule.yearMonth}`,
        JSON.parse(schedule.workDates) as string[],
      ]),
    ),
    shiftOverrideByGroupDate: new Map(
      shiftOverrideRows.map((override) => [`${override.groupId}_${override.date}`, override]),
    ),
    attendanceByParticipantDate: new Map(
      attendanceRows.map((log) => [`${log.participantId}_${log.workDate}`, log]),
    ),
    paidLeaveRows,
    trainingRows,
  };
};

// 읽어둔 재료로 한 달치를 계산한다(쿼리 없음).
const computeMonthFromData = (
  data: CapacityPayrollData,
  program: Program,
  month: string,
  participantsToCompute: Participant[],
): Map<number, CapacityPayrollMonth> => {
  const monthDates = listMonthDates(month);

  // 그날 그 조의 소정근로시간 — 날짜별 근무시간(groupShiftOverrides)이 있으면 그 값을 쓴다
  // (lib/scheduling.ts resolveGroupShift와 같은 우선순위). 조가 없으면 1일 소정근로시간.
  const scheduledHoursOn = (groupId: number | null, date: string) => {
    const group = groupId ? data.groupById.get(groupId) : undefined;
    if (!group) return DAILY_STANDARD_HOURS;
    const override = data.shiftOverrideByGroupDate.get(`${group.id}_${date}`);
    const shiftStart = override?.shiftStart ?? group.shiftStart;
    const shiftEnd = override?.shiftEnd ?? group.shiftEnd;
    return (toMinutes(shiftEnd) - toMinutes(shiftStart)) / 60;
  };

  const result = new Map<number, CapacityPayrollMonth>();

  for (const participant of participantsToCompute) {
    const workDates =
      data.participantWorkDates.get(`${participant.id}_${month}`) ??
      (participant.groupId
        ? data.groupWorkDates.get(`${participant.groupId}_${month}`)
        : undefined) ??
      null;
    const paidLeaves = data.paidLeaveRows.filter((leave) => leave.participantId === participant.id);

    let actualMinutes = 0;
    let attendedScheduledHours = 0;
    let paidLeaveHours = 0;
    let holidayPaidHours = 0;

    for (const date of monthDates) {
      const log = data.attendanceByParticipantDate.get(`${participant.id}_${date}`);
      const isScheduled = workDates ? workDates.includes(date) : false;

      if (log?.clockIn) {
        actualMinutes += log.totalMinutes ?? 0;
        // 소정근로일에 출근했으면 지각·조퇴와 상관없이 그날 소정근로시간 전체를 인정한다.
        // 스케줄에 없는 날 나온 근무는 실제 시간만 인정한다.
        attendedScheduledHours += isScheduled
          ? scheduledHoursOn(participant.groupId, date)
          : (log.totalMinutes ?? 0) / 60;
        continue;
      }

      const isOnPaidLeave = paidLeaves.some(
        (leave) => leave.leaveStart <= date && leave.leaveEnd >= date,
      );
      // 유급휴가는 근무하기로 한 날에 쓴 것만 시간으로 친다 — 스케줄이 아직 없으면 평일만.
      if (isOnPaidLeave && (workDates ? isScheduled : isWeekday(date) && !getHolidayName(date))) {
        paidLeaveHours += scheduledHoursOn(participant.groupId, date);
        continue;
      }

      if (getHolidayName(date) && isWeekday(date) && isEmployedOn(participant, program, date)) {
        holidayPaidHours += DAILY_STANDARD_HOURS;
      }
    }

    const trainingHours = data.trainingRows
      .filter((log) => log.participantId === participant.id && log.attendDate.startsWith(month))
      .reduce((sum, log) => sum + log.attendHours, 0);

    const recognizedHours = roundToTenth(
      attendedScheduledHours + paidLeaveHours + trainingHours + holidayPaidHours,
    );

    result.set(participant.id, {
      actualWorkHours: roundToTenth(actualMinutes / 60),
      attendedScheduledHours: roundToTenth(attendedScheduledHours),
      paidLeaveHours: roundToTenth(paidLeaveHours),
      trainingHours: roundToTenth(trainingHours),
      holidayPaidHours,
      recognizedHours,
      weeklyHolidayHours: toWeeklyHolidayHours(recognizedHours),
    });
  }

  return result;
};

/**
 * 사업단 한 곳의 한 달치 역량활용 급여 계산 기초값을 참여자별로 만든다.
 * participantsToCompute에 넘긴 참여자만 계산한다(목록 필터링은 호출부 몫).
 */
export const computeCapacityPayrollMonth = async (
  db: DB,
  program: Program,
  month: string,
  participantsToCompute: Participant[],
): Promise<Map<number, CapacityPayrollMonth>> => {
  const data = await loadCapacityPayrollData(db, program, month, month);
  return computeMonthFromData(data, program, month, participantsToCompute);
};

export const nextMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 12
    ? `${year + 1}-01`
    : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
};

/**
 * 그해 개근 연차 일수 — 그해의 끝난 달(1일~말일, 사업단 기간 안) 중 인정 근로시간이 60시간인
 * 달 1개당 1일, 최대 10일. 저장해두지 않고 볼 때마다 계산하므로 지난달 출퇴근 기록을 고치면
 * 연차에도 바로 반영된다. 진행 중인 달은 아직 개근이 확정되지 않아 세지 않는다.
 */
export const computeAccruedLeaveDays = async (
  db: DB,
  program: Program,
  year: string,
  // 이 달 전까지만 센다(보통 이번 달 — 진행 중인 달은 개근이 확정되지 않았다)
  currentMonth: string,
  participantsToCompute: Participant[],
): Promise<Map<number, number>> => {
  const programFirstMonth = program.startDate.slice(0, 7);
  const programLastMonth = program.endDate.slice(0, 7);
  const firstMonth = programFirstMonth > `${year}-01` ? programFirstMonth : `${year}-01`;
  const months: string[] = [];
  for (
    let month = firstMonth;
    month <= `${year}-12` && month <= programLastMonth && month < currentMonth;
    month = nextMonth(month)
  ) {
    months.push(month);
  }

  const accruedDays = new Map(participantsToCompute.map((participant) => [participant.id, 0]));
  if (months.length === 0 || participantsToCompute.length === 0) return accruedDays;

  const data = await loadCapacityPayrollData(db, program, months[0], months[months.length - 1]);
  for (const month of months) {
    const monthResult = computeMonthFromData(data, program, month, participantsToCompute);
    for (const [participantId, payroll] of monthResult) {
      if (payroll.recognizedHours >= MONTHLY_STANDARD_HOURS) {
        accruedDays.set(participantId, (accruedDays.get(participantId) ?? 0) + 1);
      }
    }
  }

  for (const [participantId, days] of accruedDays) {
    accruedDays.set(participantId, Math.min(days, MAX_ACCRUED_LEAVE_DAYS_PER_YEAR));
  }
  return accruedDays;
};

// 미사용 연차는 매달 주지 않고 계약이 끝나는 달에 한 번 정산한다 — 그달에 참여 종료됐거나
// 사업단 종료일이 그달 안에 있으면 정산 대상.
export const isContractEndingInMonth = (
  participant: Participant,
  program: Program,
  month: string,
): boolean => {
  if (program.endDate.slice(0, 7) === month) return true;
  return (
    participant.status === "DROPPED" &&
    !!participant.droppedAt &&
    participant.droppedAt.slice(0, 7) === month
  );
};
