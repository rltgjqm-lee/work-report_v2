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
} from "../db/schema";
import { canAccessProgram, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

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

// 출근부 (역량활동) CSV — 참여자별 월간 캘린더, 출석일은 조의 근무시간 표시
app.get("/:id/export/attendance", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month");
  if (!month) return c.json({ error: "month is required" }, 400);

  const program = await loadAccessibleProgram(db, programId);
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) return c.json({ error: "Forbidden" }, 403);

  const rows = await db
    .select({
      log: attendanceLogs,
      participantName: participants.name,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
    })
    .from(attendanceLogs)
    .innerJoin(participants, eq(attendanceLogs.participantId, participants.id))
    .leftJoin(groups, eq(attendanceLogs.groupId, groups.id))
    .where(
      and(eq(attendanceLogs.programId, programId), like(attendanceLogs.workDate, `${month}%`)),
    );

  const byParticipant = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.participantName;
    if (!byParticipant.has(key)) byParticipant.set(key, []);
    byParticipant.get(key)!.push(row);
  }

  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();

  const header = ["참여자명", ...Array.from({ length: daysInMonth }, (_, i) => `${i + 1}일`), "출석일수"];
  const csvRows: (string | number | null)[][] = [
    [`출근부 (${month}) — ${program.name}`],
    [],
    header,
  ];

  for (const [name, logs] of byParticipant) {
    const byDay = new Map(logs.map((l) => [Number(l.log.workDate.split("-")[2]), l]));
    const row: (string | number | null)[] = [name];
    let presentDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const log = byDay.get(d);
      if (log && log.log.clockIn) {
        presentDays++;
        row.push(
          log.shiftStart && log.shiftEnd ? `${log.shiftStart}~${log.shiftEnd}` : "출석",
        );
      } else {
        row.push("");
      }
    }
    row.push(presentDays);
    csvRows.push(row);
  }

  return toCsvResponse(csvRows, `출근부_${month}.csv`);
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
