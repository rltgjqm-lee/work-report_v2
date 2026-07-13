import { sql } from "drizzle-orm";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  rep: text("rep"),
  phone: text("phone"),
  fax: text("fax"),
  bizNo: text("biz_no"),
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
  regionSido: text("region_sido"),
  regionSigungu: text("region_sigungu"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const participants = sqliteTable("participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  name: text("name").notNull(),
  demandName: text("demand_name"),
  phoneLast4: text("phone_last4").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role")
    .$type<"super_admin" | "org_admin">()
    .notNull()
    .default("super_admin"),
  organizationId: integer("organization_id").references(() => organizations.id),
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

// 재난문자 중복 발송 방지용 처리 이력 (외부 API 메시지 고유 id 기록)
export const processedDisasterMessages = sqliteTable(
  "processed_disaster_messages",
  {
    id: text("id").primaryKey(),
    processedAt: text("processed_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
);

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

// 향후 어드민/일지 제출 연동 시 사용 (이번 단계에서는 API 미제공)
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
