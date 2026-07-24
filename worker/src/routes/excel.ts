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

const toCsvResponse = (rows: (string | number | null | undefined)[][], filename: string) => {
  const csv =
    "﻿" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const value = cell ?? "";
            const escaped = String(value).replace(/"/g, '""');
            return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
          })
          .join(","),
      )
      .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};

const loadAccessibleProgram = async (
  db: ReturnType<typeof drizzle>,
  programId: number,
) => {
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
  if (!month) return c.json({ error: "month is required" }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "Forbidden" }, 403);

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
    .where(
      and(eq(participants.programId, programId), like(activityLogs.actDate, `${month}%`)),
    )
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
  if (!month) return c.json({ error: "month is required" }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "Forbidden" }, 403);

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
    .where(
      and(eq(participants.programId, programId), like(activityLogs.actDate, `${month}%`)),
    );

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
  if (!month) return c.json({ error: "month is required" }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "Forbidden" }, 403);

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

  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();

  const participantsPayload = activeParticipants.map(({ participant, groupName, shiftStart, shiftEnd }) => {
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
  });

  return c.json({
    programName: program.name,
    month,
    participants: participantsPayload,
  });
});

// 급여대장 CSV — 계좌/주민번호는 담당자가 수기로 채우도록 빈 칸 (9장 결정)
app.get("/:id/export/payment", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month");
  if (!month) return c.json({ error: "month is required" }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "Forbidden" }, 403);

  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, program.organizationId));
  const org = orgRows[0];

  const participantRows = await db
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

  const csvRows: (string | number | null)[][] = [
    [`급여대장 (${month}) — ${org?.name ?? ""} / ${program.name}`],
    [
      "시급",
      program.hourlyWage,
      "교육비",
      `${program.educationAmount}(${program.educationType})`,
      "치매검진비",
      `${program.dementiaAmount}(${program.dementiaType})`,
    ],
    [
      "건강보험료율(%)",
      program.healthInsuranceRate,
      "장기요양보험료율(%)",
      program.longtermCareRate,
      "고용보험료율(%)",
      program.employmentInsuranceRate,
      "산재보험료율(%)",
      program.industrialAccidentRate,
    ],
    [],
    ["참여자명", "생년", "근무시간(분)", "은행명", "계좌번호", "주민번호"],
    ...participantRows.map((p) => [
      p.name,
      p.birthYear,
      minutesByParticipant.get(p.id) ?? 0,
      "", // 계좌 정보는 DB에 저장하지 않음 — 담당자 수기 입력
      "",
      "",
    ]),
  ];

  return toCsvResponse(csvRows, `급여대장_${month}.csv`);
});

export default app;
