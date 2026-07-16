import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  rep: text("rep"),
  phone: text("phone"),
  fax: text("fax"),
  bizNo: text("biz_no"),
  regionSido: text("region_sido"),
  regionSigungu: text("region_sigungu"),
  agencyType: text("agency_type"),
  prjYear: text("prj_year"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const programs = sqliteTable("programs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  projectType: text("project_type"),
  hourlyWage: integer("hourly_wage").notNull().default(3000),
  educationAmount: integer("education_amount").notNull().default(0),
  educationType: text("education_type")
    .$type<"add" | "deduct">()
    .notNull()
    .default("add"),
  dementiaAmount: integer("dementia_amount").notNull().default(0),
  dementiaType: text("dementia_type")
    .$type<"add" | "deduct">()
    .notNull()
    .default("deduct"),
  healthInsuranceRate: real("health_insurance_rate").notNull().default(3.545),
  longtermCareRate: real("longterm_care_rate").notNull().default(12.27),
  employmentInsuranceRate: real("employment_insurance_rate")
    .notNull()
    .default(0.9),
  industrialAccidentRate: real("industrial_accident_rate")
    .notNull()
    .default(1.5),
  annualLeaveDailyWage: integer("annual_leave_daily_wage")
    .notNull()
    .default(31710),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  name: text("name").notNull(),
  description: text("description"),
  shiftStart: text("shift_start").notNull(),
  shiftEnd: text("shift_end").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const participants = sqliteTable("participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  groupId: integer("group_id").references(() => groups.id),
  name: text("name").notNull(),
  demandName: text("demand_name"),
  phoneLast4: text("phone_last4").notNull(),
  birthYear: integer("birth_year"),
  status: text("status")
    .$type<"ACTIVE" | "DROPPED" | "ON_LEAVE">()
    .notNull()
    .default("ACTIVE"),
  droppedAt: text("dropped_at"),
  dropReason: text("drop_reason"),
  leaveStart: text("leave_start"),
  leaveEnd: text("leave_end"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 참여자 휴무 이력 (participants.leaveStart/leaveEnd는 "현재 휴무"만 나타내고, 지난 휴무 기록은 여기 누적)
export const participantLeaves = sqliteTable("participant_leaves", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  participantId: integer("participant_id")
    .notNull()
    .references(() => participants.id),
  leaveStart: text("leave_start").notNull(),
  leaveEnd: text("leave_end").notNull(),
  reason: text("reason"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => admins.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // 기존 행은 마이그레이션 직후 NULL — 배포 전 Cloudflare Access 허용 이메일로 수동 채워야 함
  email: text("email").unique(),
  role: text("role")
    .$type<"SUPER_ADMIN" | "AGENCY_ADMIN" | "SUB_ADMIN" | "MANAGER">()
    .notNull()
    .default("MANAGER"),
  organizationId: integer("organization_id").references(() => organizations.id),
  // MANAGER: 담당 사업단(복수) id 배열을 JSON 문자열로 저장 (예: "[1,2,3]")
  projectIds: text("project_ids"),
  // SUB_ADMIN: 담당 조(복수) id 배열을 JSON 문자열로 저장
  groupIds: text("group_ids"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 매칭은 됐지만 아직 실제 발송(외부 fetch) 전인 푸시 대기열.
// Workers 무료 플랜의 "실행당 외부 요청 50개" 한도 때문에, 매칭 즉시 보내지 않고
// 여기 쌓아뒀다가 실행마다 정해진 개수만큼만 꺼내서 보낸다 (checkDisasterAlerts.ts 참고).
export const pendingPushes = sqliteTable("pending_pushes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  messageId: text("message_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 재난문자 발송 이력 (관리자 조회용 — 중복방지 겸용, alertId = 행안부 API의 메시지 고유 id)
export const safetyAlerts = sqliteTable("safety_alerts", {
  alertId: text("alert_id").primaryKey(),
  message: text("message").notNull(),
  region: text("region"),
  sentAt: text("sent_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 재난문자 발송 로그 (구독/기기 단위 — 구독이 나중에 삭제돼도 조회 가능하도록 programId를 그대로 저장)
export const disasterPushLogs = sqliteTable("disaster_push_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  messageId: text("message_id").notNull(),
  endpoint: text("endpoint").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  sentAt: text("sent_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 참여자 셀프 체크인/아웃 근태 기록 (GPS 검증 없음 — 출석 여부만 기록, 시간은 조의 shiftStart/shiftEnd 기준으로 표시)
export const attendanceLogs = sqliteTable("attendance_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  participantId: integer("participant_id")
    .notNull()
    .references(() => participants.id),
  groupId: integer("group_id").references(() => groups.id),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  workDate: text("work_date").notNull(),
  clockIn: text("clock_in"),
  clockOut: text("clock_out"),
  totalMinutes: integer("total_minutes"),
  note: text("note"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const activityLogs = sqliteTable("activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  participantId: integer("participant_id")
    .notNull()
    .references(() => participants.id),
  actDate: text("act_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  content: text("content"),
  place: text("place"),
  hasAccident: integer("has_accident", { mode: "boolean" })
    .notNull()
    .default(false),
  accidentDetail: text("accident_detail"),
  accidentAction: text("accident_action"),
  userSignature: text("user_signature"),
  demandSignature: text("demand_signature"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});
