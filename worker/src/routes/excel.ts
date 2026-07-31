import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, like } from "drizzle-orm";

import {
  programs,
  participants,
  groups,
  activityLogs,
  attendanceLogs,
  organizations,
  groupMonthlySchedule,
  participantMonthlySchedule,
  participantLeaves,
  participantAnnualLeave,
  participantTrainingLogs,
} from "../db/schema";
import { canAccessProgram, getAuth } from "../lib/authz";
import { getHolidayName } from "../lib/koreanHolidays";
import type { Env } from "../types";

const app = new Hono<Env>();

const base64FromArrayBuffer = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const loadAccessibleProgram = async (db: ReturnType<typeof drizzle>, programId: number) => {
  const rows = await db.select().from(programs).where(eq(programs.id, programId));
  return rows[0] ?? null;
};

// 활동일지 (공익활동) — 참여자별 시트로 조립할 원본 데이터. 실제 xlsx(서식+서명 이미지)는
// 관리자 콘솔이 exceljs로 클라이언트에서 조립한다 (다운로드 참여자 개인용 흐름과 서식 통일).
app.get("/:id/export/activity-log", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month");
  if (!month) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "권한이 없습니다." }, 403);

  const organizationRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, program.organizationId));
  const organizationName = organizationRows[0]?.name ?? "";

  const rows = await db
    .select({
      log: activityLogs,
      participantName: participants.name,
      demandName: participants.demandName,
    })
    .from(activityLogs)
    .innerJoin(participants, eq(activityLogs.participantId, participants.id))
    .where(and(eq(participants.programId, programId), like(activityLogs.actDate, `${month}%`)))
    .orderBy(activityLogs.actDate);

  const participantsByName = new Map<
    string,
    { demandName: string | null; logs: (typeof rows)[number]["log"][] }
  >();
  for (const row of rows) {
    if (!participantsByName.has(row.participantName)) {
      participantsByName.set(row.participantName, {
        demandName: row.demandName,
        logs: [],
      });
    }
    participantsByName.get(row.participantName)!.logs.push(row.log);
  }

  return c.json({
    programName: program.name,
    organizationName,
    participants: Array.from(participantsByName.entries()).map(
      ([participantName, participantData]) => ({
        participantName,
        demandName: participantData.demandName,
        logs: participantData.logs.map((log) => ({
          actDate: log.actDate,
          startTime: log.startTime,
          endTime: log.endTime,
          content: log.content,
          place: log.place,
          hasAccident: log.hasAccident,
          accidentDetail: log.accidentDetail,
          accidentAction: log.accidentAction,
          userSignature: log.userSignature,
          demandSignature: log.demandSignature,
        })),
      }),
    ),
  });
});

// 활동비 지급 대장 (공익활동) — 참여자별 시트가 아니라 사업단 전체 대장 1장이라
// 원본 데이터만 JSON으로 내려주고, 실제 xlsx(병합 셀 서식)는 관리자 콘솔이
// exceljs로 클라이언트에서 조립한다.
app.get("/:id/export/activity-payment", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month");
  if (!month) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "권한이 없습니다." }, 403);

  const organizationRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, program.organizationId));
  const organizationName = organizationRows[0]?.name ?? "";

  const activeParticipants = await db
    .select()
    .from(participants)
    .where(and(eq(participants.programId, programId), eq(participants.status, "ACTIVE")));

  const logRows = await db
    .select({ log: activityLogs })
    .from(activityLogs)
    .innerJoin(participants, eq(activityLogs.participantId, participants.id))
    .where(and(eq(participants.programId, programId), like(activityLogs.actDate, `${month}%`)));

  const minutesByParticipant = new Map<number, number>();
  for (const { log } of logRows) {
    const [startHour, startMinute] = log.startTime.split(":").map(Number);
    const [endHour, endMinute] = log.endTime.split(":").map(Number);
    const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    minutesByParticipant.set(
      log.participantId,
      (minutesByParticipant.get(log.participantId) ?? 0) + minutes,
    );
  }

  const sortedParticipants = [...activeParticipants].sort((a, b) => {
    const demandCompare = (a.demandName ?? "").localeCompare(b.demandName ?? "");
    return demandCompare !== 0 ? demandCompare : a.name.localeCompare(b.name);
  });

  return c.json({
    programName: program.name,
    organizationName,
    hourlyWage: program.hourlyWage,
    participants: sortedParticipants.map((participant) => ({
      name: participant.name,
      demandName: participant.demandName,
      minutes: minutesByParticipant.get(participant.id) ?? 0,
    })),
  });
});

// 출근부 (역량활동) — 참여자별 일자별 출근/결근/공휴일/주말 + 서명 이미지(base64).
// 실제 xlsx(참여자별 시트, 2단 레이아웃)는 관리자 콘솔이 exceljs로 클라이언트에서 조립한다.
app.get("/:id/export/attendance", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month");
  if (!month) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "권한이 없습니다." }, 403);

  const activeParticipants = await db
    .select({
      participant: participants,
      groupName: groups.name,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
    })
    .from(participants)
    .leftJoin(groups, eq(participants.groupId, groups.id))
    .where(and(eq(participants.programId, programId), eq(participants.status, "ACTIVE")));

  const groupScheduleRows = await db
    .select()
    .from(groupMonthlySchedule)
    .where(eq(groupMonthlySchedule.yearMonth, month));
  const groupScheduleByGroupId = new Map(
    groupScheduleRows.map((row) => [row.groupId, JSON.parse(row.workDates) as string[]]),
  );

  const participantScheduleRows = await db
    .select()
    .from(participantMonthlySchedule)
    .where(eq(participantMonthlySchedule.yearMonth, month));
  const participantScheduleByParticipantId = new Map(
    participantScheduleRows.map((row) => [
      row.participantId,
      JSON.parse(row.workDates) as string[],
    ]),
  );

  const logRows = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(eq(attendanceLogs.programId, programId), like(attendanceLogs.workDate, `${month}%`)),
    );
  const logByParticipantDate = new Map(
    logRows.map((log) => [`${log.participantId}_${log.workDate}`, log]),
  );

  // 서명 이미지는 R2에서 읽어 base64로 미리 변환해둔다 (클라이언트에서 exceljs로 삽입).
  const signatureBase64ByKey = new Map<string, string>();
  await Promise.all(
    logRows
      .filter((log) => log.signatureKey)
      .map(async (log) => {
        const object = await c.env.SIGNATURES_BUCKET.get(log.signatureKey!);
        if (!object) return;
        const buffer = await object.arrayBuffer();
        signatureBase64ByKey.set(log.signatureKey!, base64FromArrayBuffer(buffer));
      }),
  );

  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

  const participantsPayload = activeParticipants.map(
    ({ participant, groupName, shiftStart, shiftEnd }) => {
      const scheduledDates =
        participantScheduleByParticipantId.get(participant.id) ??
        (participant.groupId ? groupScheduleByGroupId.get(participant.groupId) : undefined) ??
        [];

      const days = Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = `${month}-${String(day).padStart(2, "0")}`;
        const holidayName = getHolidayName(date);
        const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const log = logByParticipantDate.get(`${participant.id}_${date}`);

        if (holidayName) {
          return { day, date, marker: "HOLIDAY" as const, label: holidayName };
        }
        if (isWeekend) {
          return { day, date, marker: "WEEKEND" as const, label: "주말" };
        }
        if (log?.clockIn) {
          return {
            day,
            date,
            marker: "PRESENT" as const,
            startTime: log.clockIn.slice(11, 16),
            endTime: log.clockOut ? log.clockOut.slice(11, 16) : null,
            totalMinutes: log.totalMinutes,
            signatureBase64: log.signatureKey
              ? (signatureBase64ByKey.get(log.signatureKey) ?? null)
              : null,
          };
        }
        if (scheduledDates.includes(date)) {
          return { day, date, marker: "ABSENT" as const };
        }
        return { day, date, marker: "NONE" as const };
      });

      return {
        name: participant.name,
        groupName: groupName ?? "미배정",
        shiftStart,
        shiftEnd,
        days,
      };
    },
  );

  return c.json({
    programName: program.name,
    month,
    participants: participantsPayload,
  });
});

// 근무 스케줄표 (역량활동) — 근로계약서에 첨부하는 월별 근무일/휴무일 캘린더.
// 원본 데이터만 내려주고, 실제 xlsx(달력 격자)는 관리자 콘솔이 exceljs로 조립한다.
app.get("/:id/export/work-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month");
  if (!month) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "권한이 없습니다." }, 403);

  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, program.organizationId));
  const org = orgRows[0];

  const activeParticipants = await db
    .select({
      participant: participants,
      groupName: groups.name,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
    })
    .from(participants)
    .leftJoin(groups, eq(participants.groupId, groups.id))
    .where(and(eq(participants.programId, programId), eq(participants.status, "ACTIVE")));

  const groupScheduleRows = await db
    .select()
    .from(groupMonthlySchedule)
    .where(eq(groupMonthlySchedule.yearMonth, month));
  const groupScheduleByGroupId = new Map(
    groupScheduleRows.map((row) => [row.groupId, JSON.parse(row.workDates) as string[]]),
  );

  const participantScheduleRows = await db
    .select()
    .from(participantMonthlySchedule)
    .where(eq(participantMonthlySchedule.yearMonth, month));
  const participantScheduleByParticipantId = new Map(
    participantScheduleRows.map((row) => [
      row.participantId,
      JSON.parse(row.workDates) as string[],
    ]),
  );

  const monthStart = `${month}-01`;
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const clipLeaveDaysToMonth = (leaveStart: string, leaveEnd: string): number => {
    const start = leaveStart > monthStart ? leaveStart : monthStart;
    const end = leaveEnd < monthEnd ? leaveEnd : monthEnd;
    if (start > end) return 0;
    const diffDays =
      (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
      86400000;
    return diffDays + 1;
  };

  const leaveRows = await db
    .select({ leave: participantLeaves })
    .from(participantLeaves)
    .innerJoin(participants, eq(participantLeaves.participantId, participants.id))
    .where(eq(participants.programId, programId))
    .then((rows) => rows.map((row) => row.leave));
  const leavesByParticipant = new Map<number, typeof leaveRows>();
  for (const leave of leaveRows) {
    if (leave.leaveEnd < monthStart || leave.leaveStart > monthEnd) continue;
    if (!leavesByParticipant.has(leave.participantId)) {
      leavesByParticipant.set(leave.participantId, []);
    }
    leavesByParticipant.get(leave.participantId)!.push(leave);
  }

  const attendanceRows = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(eq(attendanceLogs.programId, programId), like(attendanceLogs.workDate, `${month}%`)),
    );
  const presentDaysByParticipant = new Map<number, number>();
  for (const log of attendanceRows) {
    if (!log.clockIn) continue;
    presentDaysByParticipant.set(
      log.participantId,
      (presentDaysByParticipant.get(log.participantId) ?? 0) + 1,
    );
  }

  const participantsPayload = activeParticipants.map(
    ({ participant, groupName, shiftStart, shiftEnd }) => {
      const scheduledDates =
        participantScheduleByParticipantId.get(participant.id) ??
        (participant.groupId ? groupScheduleByGroupId.get(participant.groupId) : undefined) ??
        [];

      const leaves = leavesByParticipant.get(participant.id) ?? [];
      let unpaidLeaveDays = 0;
      let paidLeaveDays = 0;
      for (const leave of leaves) {
        const days = clipLeaveDaysToMonth(leave.leaveStart, leave.leaveEnd);
        if (leave.leaveType === "UNPAID") unpaidLeaveDays += days;
        else paidLeaveDays += days;
      }

      return {
        name: participant.name,
        groupName: groupName ?? "미배정",
        shiftStart,
        shiftEnd,
        createdAt: participant.createdAt,
        scheduledDates,
        unpaidLeaveDays,
        paidLeaveDays,
        presentDays: presentDaysByParticipant.get(participant.id) ?? 0,
      };
    },
  );

  return c.json({
    organizationName: org?.name ?? "",
    organizationRep: org?.rep ?? "",
    organizationAddress: org?.address ?? "",
    month,
    participants: participantsPayload,
  });
});

// 급여 명세서 (역량활동) — 4대보험만 자동 계산하고 나머지(주휴수당/연차수당/기타수당/
// 팀장수당/소득세/지방세/생년월일/기관보조금)는 데이터가 없어서 빈 칸으로 남긴다.
// 산재보험은 전액 사업주 부담이라 근로자 명세서엔 0으로 표시(계산 안 함).
app.get("/:id/export/payslip", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month");
  if (!month) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "권한이 없습니다." }, 403);

  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, program.organizationId));
  const org = orgRows[0];

  const activeParticipants = await db
    .select()
    .from(participants)
    .where(and(eq(participants.programId, programId), eq(participants.status, "ACTIVE")));

  const attendanceRows = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(eq(attendanceLogs.programId, programId), like(attendanceLogs.workDate, `${month}%`)),
    );
  const minutesByParticipant = new Map<number, number>();
  for (const log of attendanceRows) {
    if (!log.totalMinutes) continue;
    minutesByParticipant.set(
      log.participantId,
      (minutesByParticipant.get(log.participantId) ?? 0) + log.totalMinutes,
    );
  }

  return c.json({
    organizationName: org?.name ?? "",
    month,
    hourlyWage: program.hourlyWage,
    healthInsuranceRate: program.healthInsuranceRate,
    longtermCareRate: program.longtermCareRate,
    employmentInsuranceRate: program.employmentInsuranceRate,
    participants: activeParticipants.map((participant) => ({
      name: participant.name,
      actualWorkHours: Math.round(((minutesByParticipant.get(participant.id) ?? 0) / 60) * 10) / 10,
    })),
  });
});

// 급여대장 CSV — 계좌/주민번호는 담당자가 수기로 채우도록 빈 칸 (9장 결정)
// 급여대장 (역량활동) — 실제 서식(work-report-v4/서식(1)/역량활용/2026ESG 급여대장.xlsx
// 의 "인건비 (6)" 시트)과 같은 33열 구조. 만근 기준 근무시간/주휴시간은 이 사업만의
// 정책값이라 자동 계산하지 않고 엑셀에서 직접 입력하도록 빈 칸으로 남긴다.
app.get("/:id/export/payment", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month");
  if (!month) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "권한이 없습니다." }, 403);

  const activeParticipants = await db
    .select({
      participant: participants,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
    })
    .from(participants)
    .leftJoin(groups, eq(participants.groupId, groups.id))
    .where(and(eq(participants.programId, programId), eq(participants.status, "ACTIVE")));

  const attendanceRows = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(eq(attendanceLogs.programId, programId), like(attendanceLogs.workDate, `${month}%`)),
    );
  const minutesByParticipant = new Map<number, number>();
  for (const log of attendanceRows) {
    if (!log.totalMinutes) continue;
    minutesByParticipant.set(
      log.participantId,
      (minutesByParticipant.get(log.participantId) ?? 0) + log.totalMinutes,
    );
  }

  const trainingRows = await db
    .select({ log: participantTrainingLogs })
    .from(participantTrainingLogs)
    .innerJoin(participants, eq(participantTrainingLogs.participantId, participants.id))
    .where(
      and(
        eq(participants.programId, programId),
        eq(participantTrainingLogs.status, "COMPLETED"),
        like(participantTrainingLogs.attendDate, `${month}%`),
      ),
    )
    .then((rows) => rows.map((row) => row.log));
  const trainingHoursByParticipant = new Map<number, number>();
  for (const log of trainingRows) {
    trainingHoursByParticipant.set(
      log.participantId,
      (trainingHoursByParticipant.get(log.participantId) ?? 0) + log.attendHours,
    );
  }

  const monthStart = `${month}-01`;
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const clipLeaveDaysToMonth = (leaveStart: string, leaveEnd: string): number => {
    const start = leaveStart > monthStart ? leaveStart : monthStart;
    const end = leaveEnd < monthEnd ? leaveEnd : monthEnd;
    if (start > end) return 0;
    const diffDays =
      (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
      86400000;
    return diffDays + 1;
  };

  const leaveRows = await db
    .select({ leave: participantLeaves })
    .from(participantLeaves)
    .innerJoin(participants, eq(participantLeaves.participantId, participants.id))
    .where(and(eq(participants.programId, programId), eq(participantLeaves.leaveType, "PAID")))
    .then((rows) => rows.map((row) => row.leave));
  const paidLeaveDaysByParticipant = new Map<number, number>();
  for (const leave of leaveRows) {
    if (leave.leaveEnd < monthStart || leave.leaveStart > monthEnd) continue;
    const days = clipLeaveDaysToMonth(leave.leaveStart, leave.leaveEnd);
    paidLeaveDaysByParticipant.set(
      leave.participantId,
      (paidLeaveDaysByParticipant.get(leave.participantId) ?? 0) + days,
    );
  }

  const annualLeaveRows = await db
    .select({ leave: participantAnnualLeave })
    .from(participantAnnualLeave)
    .innerJoin(participants, eq(participantAnnualLeave.participantId, participants.id))
    .where(
      and(
        eq(participants.programId, programId),
        eq(participantAnnualLeave.year, month.slice(0, 4)),
      ),
    )
    .then((rows) => rows.map((row) => row.leave));
  const remainingLeaveDaysByParticipant = new Map(
    annualLeaveRows.map((leave) => [leave.participantId, leave.remainingDays]),
  );

  const participantsPayload = activeParticipants.map(({ participant, shiftStart, shiftEnd }) => {
    const dailyHours =
      shiftStart && shiftEnd
        ? (() => {
            const [sh, sm] = shiftStart.split(":").map(Number);
            const [eh, em] = shiftEnd.split(":").map(Number);
            return (eh * 60 + em - (sh * 60 + sm)) / 60;
          })()
        : 0;

    return {
      name: participant.name,
      actualWorkHours: Math.round(((minutesByParticipant.get(participant.id) ?? 0) / 60) * 10) / 10,
      trainingHours: trainingHoursByParticipant.get(participant.id) ?? 0,
      paidLeaveHours: (paidLeaveDaysByParticipant.get(participant.id) ?? 0) * dailyHours,
      remainingLeaveHours: (remainingLeaveDaysByParticipant.get(participant.id) ?? 0) * dailyHours,
    };
  });

  return c.json({
    programName: program.name,
    month,
    hourlyWage: program.hourlyWage,
    healthInsuranceRate: program.healthInsuranceRate,
    longtermCareRate: program.longtermCareRate,
    employmentInsuranceRate: program.employmentInsuranceRate,
    employmentInsuranceEmployerRate: program.employmentInsuranceEmployerRate,
    industrialAccidentRate: program.industrialAccidentRate,
    participants: participantsPayload,
  });
});

export default app;
