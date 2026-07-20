import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { ROLES, type AdminRole } from "../types";

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
  organizationType: text("organization_type"),
  prjYear: text("prj_year"),
  // 계약 종료 시 소프트 삭제 — 소속 사업단 등 참조 데이터를 지우지 않고 목록에서만 숨김
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
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
  programType: text("program_type"),
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
  // 계약 종료 시 소프트 삭제 — 비활성화하면 소속 활성 참여자도 함께 참여종료 처리한다
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
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

// 수요처 — 참여자가 실제로 활동하는 장소. 위경도+반경은 이탈 관제(geofencing)에서 사용
export const demandSites = sqliteTable("demand_sites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  name: text("name").notNull(),
  baseLat: real("base_lat").notNull(),
  baseLng: real("base_lng").notNull(),
  allowedRadius: integer("allowed_radius").notNull().default(1500),
  address: text("address"),
  contactPerson: text("contact_person"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 수요처 x 조 조합별 근무시간
export const demandSiteSchedules = sqliteTable("demand_site_schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  demandSiteId: integer("demand_site_id")
    .notNull()
    .references(() => demandSites.id),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id),
  shiftStart: text("shift_start").notNull(),
  shiftEnd: text("shift_end").notNull(),
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
  // 실제 demand_sites 연결 — 이탈 관제(geofencing)에서 참여자가 있어야 할 위경도/반경을 알아내는 데 쓴다.
  // demandName(자유 텍스트)은 수요처를 아직 안 만든 사업단을 위해 그대로 남겨둔다.
  demandSiteId: integer("demand_site_id").references(() => demandSites.id),
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
  // 유급(PAID)은 연차에서 차감, 무급(UNPAID)은 연차 잔여 확인/차감 없음
  leaveType: text("leave_type")
    .$type<"PAID" | "UNPAID">()
    .notNull()
    .default("PAID"),
  // 서버가 leaveStart~leaveEnd로 자동 계산해 저장 (일 수)
  leaveDays: integer("leave_days").notNull().default(0),
  reason: text("reason"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => admins.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 참여자 연도별 연차 잔여 — PAID 휴가 등록 시 이 값을 확인/차감한다
export const participantAnnualLeave = sqliteTable(
  "participant_annual_leave",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id),
    year: text("year").notNull(),
    totalDays: integer("total_days").notNull().default(0),
    usedDays: integer("used_days").notNull().default(0),
    remainingDays: integer("remaining_days").notNull().default(0),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("participant_annual_leave_participant_year_unique").on(
      table.participantId,
      table.year,
    ),
  ],
);

export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // 기존 행은 마이그레이션 직후 NULL — 배포 전 Cloudflare Access 허용 이메일로 수동 채워야 함
  email: text("email").unique(),
  // 기존 행(수동 등록분)엔 없을 수 있어 nullable — 관리자 계정 CRUD로 새로 만드는 계정은 필수로 검증
  name: text("name"),
  role: text("role").$type<AdminRole>().notNull().default(ROLES.MANAGER),
  organizationId: integer("organization_id").references(() => organizations.id),
  // MANAGER: 담당 사업단(복수) id 배열을 JSON 문자열로 저장 (예: "[1,2,3]")
  programIds: text("program_ids"),
  // SUB_ADMIN: 담당 조(복수) id 배열을 JSON 문자열로 저장
  groupIds: text("group_ids"),
  // 계약 종료/퇴사 시 row를 지우지 않고 비활성화 — requireAdmin에서 비활성 계정은 로그인 차단
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  // 최초 구독 시점(참여자 식별 전)엔 비어있고, 출근 식별 이후 연결된다.
  // 재난문자(프로그램 전체 브로드캐스트)는 이 값이 없어도 되지만, 이탈 경고처럼
  // 특정 참여자 한 명에게만 보내야 하는 푸시는 이 값으로 대상을 찾는다.
  participantId: integer("participant_id").references(() => participants.id),
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
  // 행안부 DST_SE_NM 값을 그대로 저장(예: 폭염/호우/기타), 테스트 발송은 'TEST'
  alertType: text("alert_type"),
  // 행안부 자동수신(MOIS)과 관리자 테스트 발송(MANUAL)을 이력에서 구분하기 위함
  source: text("source").$type<"MOIS" | "MANUAL">().notNull().default("MOIS"),
  sentAt: text("sent_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 행안부 재난문자 API 일일 호출량(1000회/일 한도) 추적 — date(KST, YYYY-MM-DD)별로 누적.
// 한도에 도달하면 그날 남은 폴링에서는 API를 호출하지 않고 건너뛴다.
export const disasterApiCallLog = sqliteTable("disaster_api_call_log", {
  date: text("date").primaryKey(),
  callCount: integer("call_count").notNull().default(0),
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
  // 퇴근 시 배정된 조의 근무시간 대비 자동 판정 (지각/조퇴 여부) — 출근 중엔 NORMAL
  status: text("status")
    .$type<"NORMAL" | "LATE" | "EARLY_LEAVE">()
    .notNull()
    .default("NORMAL"),
  note: text("note"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 이탈 이벤트 1건 = 배정된 수요처 반경을 벗어난 순간(복귀 후 다시 벗어나면 새 건).
// alertCount는 이 참여자가 해결(RESOLVED) 처리 이후 다시 벗어난 누적 횟수.
export const escapeLogs = sqliteTable("escape_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  participantId: integer("participant_id")
    .notNull()
    .references(() => participants.id),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  demandSiteId: integer("demand_site_id").references(() => demandSites.id),
  detectedAt: text("detected_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  distanceKm: real("distance_km").notNull(),
  alertCount: integer("alert_count").notNull().default(1),
  status: text("status").$type<"OPEN" | "RESOLVED">().notNull().default("OPEN"),
  // 3단계(위급) 팝업을 관제 화면에서 한 번만 띄우기 위한 표시 — 팝업을 띄운 뒤 true로 바꾼다
  alerted: integer("alerted", { mode: "boolean" }).notNull().default(false),
  resolvedBy: integer("resolved_by").references(() => admins.id),
  resolvedAt: text("resolved_at"),
  memo: text("memo"),
});

// 참여자별 "현재 이탈 진행 상태" 1행 — alertCount 누적치, 지금 이탈 중이면 그 시작시각,
// 마지막으로 위치를 보고한 시각/좌표(통신 끊김 감지에도 재사용). 관리자가 이탈을
// RESOLVED 처리하면 이 행을 지워서 alertCount를 0으로 되돌린다.
export const participantEscapeMeta = sqliteTable("participant_escape_meta", {
  participantId: integer("participant_id")
    .primaryKey()
    .references(() => participants.id),
  alertCount: integer("alert_count").notNull().default(0),
  outsideStart: text("outside_start"),
  lastLat: real("last_lat"),
  lastLng: real("last_lng"),
  lastLocationAt: text("last_location_at"),
  // 통신 끊김 푸시를 매 폴링(1분)마다 중복 발송하지 않기 위한 표시 —
  // 이미 알림을 보낸 상태면 다시 안 보내고, 새 위치가 들어오면(/location) null로 초기화
  signalLossAlertedAt: text("signal_loss_alerted_at"),
  updatedAt: text("updated_at")
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
