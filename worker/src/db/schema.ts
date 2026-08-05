import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

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
  healthInsuranceRate: real("health_insurance_rate").notNull().default(3.545),
  longtermCareRate: real("longterm_care_rate").notNull().default(12.27),
  employmentInsuranceRate: real("employment_insurance_rate").notNull().default(0.9),
  // 고용보험은 근로자부담분(실업급여, employmentInsuranceRate)과 별개로 사업주가
  // 고용안정·직업능력개발사업 부담금을 추가로 낸다 — 급여대장 기관부담 계산용.
  employmentInsuranceEmployerRate: real("employment_insurance_employer_rate")
    .notNull()
    .default(1.15),
  industrialAccidentRate: real("industrial_accident_rate").notNull().default(1.5),
  annualLeaveDailyWage: integer("annual_leave_daily_wage").notNull().default(31710),
  // 계약 종료 시 소프트 삭제 — 비활성화하면 소속 활성 참여자도 함께 참여종료 처리한다
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const groups = sqliteTable(
  "groups",
  {
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
  },
  (table) => [index("idx_groups_program").on(table.programId)],
);

// 역량활동 월간 근무 스케줄(조 단위 기본값) — "월 24일"이 아니라 "월 30시간 10일" 같은
// 불규칙 근무일 패턴을 조 전체에 일괄 세팅한다. 참여자 개인 예외는 participantMonthlySchedule 참고.
export const groupMonthlySchedule = sqliteTable(
  "group_monthly_schedule",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id),
    yearMonth: text("year_month").notNull(), // "YYYY-MM"
    workDates: text("work_dates").notNull().default("[]"), // JSON: ["YYYY-MM-DD", ...]
    maxMonthlyMinutes: integer("max_monthly_minutes").notNull().default(1800),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("group_monthly_schedule_group_month_unique").on(table.groupId, table.yearMonth),
  ],
);

// 참여자 개인 예외 — 이 달에 레코드가 있으면 조 스케줄 대신 이걸 쓴다 (무급휴가 등 개인 사정).
// maxMonthlyMinutes가 null이면 조 스케줄의 상한을 그대로 따른다.
export const participantMonthlySchedule = sqliteTable(
  "participant_monthly_schedule",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id),
    yearMonth: text("year_month").notNull(),
    workDates: text("work_dates").notNull().default("[]"),
    maxMonthlyMinutes: integer("max_monthly_minutes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("participant_monthly_schedule_participant_month_unique").on(
      table.participantId,
      table.yearMonth,
    ),
  ],
);

// 참여자 날짜별 조 임시 배정 — 그날 하루만 다른 조로 취급하고, 원래 조(participants.groupId)는
// 그대로 유지된다(다음날부터 자동으로 원래 조로 돌아옴). 출퇴근 시간 판정과 근무일 판단
// (participantMonthlySchedule/groupMonthlySchedule 조회)이 모두 이 조 기준으로 바뀐다 —
// /attendance/clock-in 등에서 participant.groupId보다 먼저 확인해야 한다.
export const participantGroupOverrides = sqliteTable(
  "participant_group_overrides",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id),
    date: text("date").notNull(), // "YYYY-MM-DD"
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id),
    createdBy: integer("created_by")
      .notNull()
      .references(() => admins.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("participant_group_overrides_participant_date_unique").on(
      table.participantId,
      table.date,
    ),
  ],
);

// 수요처 마스터 — 실제 위경도/반경/다각형은 하위 demandSiteLocations로 이동(수요처 1개 : 거점 여러 개)
export const demandSites = sqliteTable("demand_sites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  name: text("name").notNull(),
  address: text("address"),
  // 담당자 — 예전엔 자유 입력 이름(contact_person)만 받았고, 지금은 관리자 계정을
  // 직접 연결한다. contact_person은 연결 이전에 쌓인 값을 읽기용으로 남겨둔 것.
  contactAdminId: integer("contact_admin_id").references(() => admins.id),
  contactPerson: text("contact_person"),
  // 수요처 단위 기본 관제구역 — 하위 거점(demand_site_locations)을 따로 그리지 않아도
  // 이 원 하나로 이탈 판정과 관제 지도 표시가 된다. 거점을 그리면 둘 다 유효 구역이 된다.
  baseLat: real("base_lat"),
  baseLng: real("base_lng"),
  radius: integer("radius"),
  // false면 baseLat/baseLng/radius가 있어도 관제 판정(buildDemandSiteAreas)에서 뺀다.
  // 다각형 거점만 쓰고 싶은 수요처를 위한 토글 — 주소/좌표 자체는 남겨둬서 다시 켤 때
  // 재지오코딩이 필요 없다.
  baseAreaEnabled: integer("base_area_enabled", { mode: "boolean" }).notNull().default(true),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 수요처 하위 거점/관제구역 — 수요처 1개에 여러 개 있을 수 있다 (건물 여러 동, 넓은 부지 등).
// RADIUS는 baseLat/baseLng/radius(m)로 원형 판정, POLYGON은 polygon(GeoJSON 좌표 배열)로 판정.
// 이탈 판정(/public/location)은 참여자가 배정된 수요처의 거점들 중 하나라도 안에 있으면 정상으로 본다.
export const demandSiteLocations = sqliteTable("demand_site_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  demandSiteId: integer("demand_site_id")
    .notNull()
    .references(() => demandSites.id),
  name: text("name").notNull(),
  shapeType: text("shape_type").$type<"RADIUS" | "POLYGON">().notNull(),
  baseLat: real("base_lat"),
  baseLng: real("base_lng"),
  radius: integer("radius"),
  // JSON: [{ lat: number, lng: number }, ...] — POLYGON일 때만 사용
  polygon: text("polygon"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 수요처에 배치된 조 매핑 — 근무시간은 조 자체의 값(groups.shiftStart/shiftEnd)을
// 그대로 따른다. 예전엔 이 표에 수요처별로 다른 시간을 따로 저장했지만, 실제 출퇴근
// 판정(worker/src/routes/public.ts)은 항상 groups.shiftStart/shiftEnd만 봐서 두 값이
// 어긋날 수 있었다 — 조 시간 하나로 통일했다.
export const demandSiteSchedules = sqliteTable(
  "demand_site_schedules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    demandSiteId: integer("demand_site_id")
      .notNull()
      .references(() => demandSites.id),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("demand_site_schedules_site_group_unique").on(table.demandSiteId, table.groupId),
  ],
);

export const participants = sqliteTable(
  "participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    groupId: integer("group_id").references(() => groups.id),
    name: text("name").notNull(),
    gender: text("gender").$type<"남성" | "여성">(),
    demandName: text("demand_name"),
    // 실제 demand_sites 연결 — 이탈 관제(geofencing)에서 참여자가 있어야 할 위경도/반경을 알아내는 데 쓴다.
    // demandName(자유 텍스트)은 수요처를 아직 안 만든 사업단을 위해 그대로 남겨둔다.
    demandSiteId: integer("demand_site_id").references(() => demandSites.id),
    birthYear: integer("birth_year"),
    status: text("status").$type<"ACTIVE" | "DROPPED" | "ON_LEAVE">().notNull().default("ACTIVE"),
    droppedAt: text("dropped_at"),
    dropReason: text("drop_reason"),
    leaveStart: text("leave_start"),
    leaveEnd: text("leave_end"),
    // 시급 — 사업단 공통값(programs.hourlyWage)이 기본이지만 참여자마다 다르게 줄 수 있어
    // null이면 사업단 시급을 그대로 따르고, 값이 있으면 이 참여자만의 시급으로 덮어쓴다.
    hourlyWage: integer("hourly_wage"),
    // 교육비/치매검진비 — 예전엔 사업단(programs) 공통값이었는데 참여자마다 달라서 이쪽으로 옮겼다.
    educationAmount: integer("education_amount").notNull().default(0),
    educationType: text("education_type")
      .$type<"add" | "deduct" | "none">()
      .notNull()
      .default("none"),
    dementiaAmount: integer("dementia_amount").notNull().default(0),
    dementiaType: text("dementia_type")
      .$type<"add" | "deduct" | "none">()
      .notNull()
      .default("none"),
    // 4대보험 가입여부/주휴시간은 역량활동 참여자만 의미가 있다 (공익활동은 UI에서 숨김).
    // 요율(%) 자체는 그대로 programs에 있고, 여기는 "이 참여자가 어떤 보험 대상인지"만
    // 하나씩 켜고 끈다 — 보험마다 가입 여부가 다를 수 있어 넷을 따로 둔다.
    healthInsuranceEnrolled: integer("health_insurance_enrolled", { mode: "boolean" })
      .notNull()
      .default(false),
    longtermCareInsuranceEnrolled: integer("longterm_care_insurance_enrolled", { mode: "boolean" })
      .notNull()
      .default(false),
    employmentInsuranceEnrolled: integer("employment_insurance_enrolled", { mode: "boolean" })
      .notNull()
      .default(false),
    industrialAccidentInsuranceEnrolled: integer("industrial_accident_insurance_enrolled", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    weeklyHolidayHours: real("weekly_holiday_hours").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("idx_participants_program").on(table.programId),
    index("idx_participants_group").on(table.groupId),
    index("idx_participants_demand_site").on(table.demandSiteId),
  ],
);

// 참여자 휴무 이력 (participants.leaveStart/leaveEnd는 "현재 휴무"만 나타내고, 지난 휴무 기록은 여기 누적)
export const participantLeaves = sqliteTable(
  "participant_leaves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id),
    leaveStart: text("leave_start").notNull(),
    leaveEnd: text("leave_end").notNull(),
    // 유급(PAID)은 연차에서 차감, 무급(UNPAID)은 연차 잔여 확인/차감 없음
    leaveType: text("leave_type").$type<"PAID" | "UNPAID">().notNull().default("PAID"),
    // 서버가 leaveStart~leaveEnd로 자동 계산해 저장 (일 수)
    leaveDays: integer("leave_days").notNull().default(0),
    reason: text("reason"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => admins.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("idx_participant_leaves_participant").on(table.participantId)],
);

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
  // MANAGER/SUB_ADMIN: 담당 사업단(복수) id 배열을 JSON 문자열로 저장 (예: "[1,2,3]")
  // — 부관리자도 사업단 담당자로 지정될 수 있어, SUB_ADMIN 계정이 groupIds와
  // programIds를 동시에 가질 수 있다.
  programIds: text("program_ids"),
  // SUB_ADMIN: 담당 조(복수) id 배열을 JSON 문자열로 저장
  groupIds: text("group_ids"),
  // 계약 종료/퇴사 시 row를 지우지 않고 비활성화 — requireAdmin에서 비활성 계정은 로그인 차단
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  // "salt:iterations:hash" 형식 (worker/src/lib/password.ts 참고). CF Access 시절 수동
  // 등록분엔 없을 수 있어 nullable — 없는 계정은 로그인 자체가 불가 (관리자가 새로 발급해야 함).
  passwordHash: text("password_hash"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 로그인 세션 — 쿠키엔 원문 토큰만 담고 DB엔 해시만 저장한다 (DB가 유출돼도 세션을
// 그대로 재사용할 수 없도록). 로그아웃 = 해당 row 삭제, 만료 = expiresAt 경과.
export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adminId: integer("admin_id")
      .notNull()
      .references(() => admins.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("idx_admin_sessions_admin_id").on(table.adminId)],
);

// 로그인 실패 횟수 추적 — 무차별 대입 방지용. 이메일 단위로 잠그며, 성공 시 초기화된다.
export const adminLoginAttempts = sqliteTable("admin_login_attempts", {
  email: text("email").primaryKey(),
  failCount: integer("fail_count").notNull().default(0),
  lockedUntil: text("locked_until"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 로그인 시도 감사 이력 — 성공/실패 모두 남긴다. adminId는 이메일이 실제 계정과
// 매칭됐을 때만 채워짐(존재하지 않는 이메일로 시도한 실패 건은 null).
export const adminLoginHistory = sqliteTable(
  "admin_login_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adminId: integer("admin_id").references(() => admins.id),
    email: text("email").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    ipAddress: text("ip_address"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("idx_admin_login_history_created").on(table.createdAt)],
);

// PUT /api/me/password(본인 비밀번호 변경)에서 현재 비밀번호를 틀린 횟수 추적 —
// 로그인 세션이 이미 있는 상태에서 현재 비밀번호를 무차별 대입하는 걸 막는다.
export const adminPasswordChangeAttempts = sqliteTable("admin_password_change_attempts", {
  adminId: integer("admin_id")
    .primaryKey()
    .references(() => admins.id),
  failCount: integer("fail_count").notNull().default(0),
  lockedUntil: text("locked_until"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// PUT /api/admins/:id/password(남의 비밀번호 재설정)를 수행한 관리자별로 15분당
// 재설정 횟수를 추적 — 탈취된 세션으로 계정을 대량 재설정/잠금시키는 남용을 막는다.
export const adminPasswordResetAttempts = sqliteTable("admin_password_reset_attempts", {
  actorAdminId: integer("actor_admin_id")
    .primaryKey()
    .references(() => admins.id),
  count: integer("count").notNull().default(0),
  windowStart: text("window_start").notNull(),
});

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    // 등록확인 화면에서 출근 식별(이름 확인)을 마친 뒤에만 구독이 만들어지므로 항상 채워진다.
    // 재난문자 대상 선정(checkDisasterAlerts)이 이 값으로 참여자의 실제 근무 스케줄을 조회하고,
    // 이탈 경고처럼 특정 참여자 한 명에게만 보내야 하는 푸시도 이 값으로 대상을 찾는다.
    participantId: integer("participant_id").references(() => participants.id),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("idx_push_subscriptions_participant").on(table.participantId)],
);

// 하이브리드 앱(Capacitor)에서 발급받은 네이티브 푸시 토큰(FCM/APNs).
// pushSubscriptions(Web Push endpoint+keys)와 별도 테이블인 이유: 네이티브 토큰은
// 구조가 다르고(문자열 토큰 하나), 실제 발송도 Web Push가 아니라 FCM API를 거쳐야 해서다.
export const pushDeviceTokens = sqliteTable(
  "push_device_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    // pushSubscriptions와 동일하게, 등록확인 화면에서 출근 식별을 마친 뒤에만 만들어지므로
    // 항상 채워진다.
    participantId: integer("participant_id").references(() => participants.id),
    platform: text("platform").$type<"android" | "ios">().notNull(),
    token: text("token").notNull().unique(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("idx_push_device_tokens_participant").on(table.participantId)],
);

// 매칭은 됐지만 아직 실제 발송(외부 fetch) 전인 푸시 대기열.
// Workers 무료 플랜의 "실행당 외부 요청 50개" 한도 때문에, 매칭 즉시 보내지 않고
// 여기 쌓아뒀다가 실행마다 정해진 개수만큼만 꺼내서 보낸다 (checkDisasterAlerts.ts 참고).
export const pendingPushes = sqliteTable("pending_pushes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  messageId: text("message_id").notNull(),
  // "web"(Web Push: endpoint/p256dh/auth 사용) | "fcm"(네이티브 앱: token 사용)
  channel: text("channel").$type<"web" | "fcm">().notNull().default("web"),
  endpoint: text("endpoint"),
  p256dh: text("p256dh"),
  auth: text("auth"),
  token: text("token"),
  body: text("body").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 재난문자 발송 이력 (관리자 조회용 — 중복방지 겸용, alertId = 행안부 API의 메시지 고유 id)
export const safetyAlerts = sqliteTable(
  "safety_alerts",
  {
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
  },
  // 관리자 콘솔 안전문자 목록이 항상 sentAt DESC로 정렬해서 조회함 (safetyAlerts.ts, disasterPushLogs.ts)
  (table) => [index("idx_safety_alerts_sent_at").on(table.sentAt)],
);

// 행안부 재난문자 API 일일 호출량(1000회/일 한도) 추적 — date(KST, YYYY-MM-DD)별로 누적.
// 한도에 도달하면 그날 남은 폴링에서는 API를 호출하지 않고 건너뛴다.
export const disasterApiCallLog = sqliteTable("disaster_api_call_log", {
  date: text("date").primaryKey(),
  callCount: integer("call_count").notNull().default(0),
});

// 재난문자 발송 로그 (구독/기기 단위 — 구독이 나중에 삭제돼도 조회 가능하도록 programId를 그대로 저장)
export const disasterPushLogs = sqliteTable(
  "disaster_push_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    messageId: text("message_id").notNull(),
    // "web"(Web Push) | "fcm"(네이티브 앱)
    channel: text("channel").$type<"web" | "fcm">().notNull().default("web"),
    endpoint: text("endpoint"),
    token: text("token"),
    success: integer("success", { mode: "boolean" }).notNull(),
    sentAt: text("sent_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  // 안전문자 관리 화면이 safetyAlerts.alertId = disasterPushLogs.messageId로 JOIN함
  (table) => [index("idx_disaster_push_logs_message").on(table.messageId)],
);

// 참여자 셀프 체크인/아웃 근태 기록. 시간은 조의 shiftStart/shiftEnd 기준으로 판정한다.
// 출퇴근 시점의 위치도 같이 남기지만 이걸로 출퇴근을 막지는 않는다 — 실제 분포를 먼저
// 모아보고(GPS 미허용률, 구역 중심까지 거리) 차단 정책을 정하기 위한 기록용이다.
export const attendanceLogs = sqliteTable(
  "attendance_logs",
  {
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
    // 퇴근 시 배정된 조의 근무시간 대비 자동 판정 (지각/조퇴 여부) — 출근 중엔 NORMAL.
    // INVALID는 관리자가 잘못된 기록을 무효화한 상태 (4-2 근태 강제수정/무효화).
    status: text("status")
      .$type<"NORMAL" | "LATE" | "EARLY_LEAVE" | "INVALID">()
      .notNull()
      .default("NORMAL"),
    note: text("note"),
    // 역량활동 하루 근무 종료 후 참여자 서명 — 실제 이미지는 R2에, 여기엔 객체 키만 저장
    signatureKey: text("signature_key"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    // 강제수정/무효화한 관리자와 시각 — 프론트에는 안 보여주고 감사 목적으로만 DB에 남긴다.
    correctedByAdminId: integer("corrected_by_admin_id").references(() => admins.id),
    correctedAt: text("corrected_at"),
    // 출근/퇴근 버튼을 누른 시점의 위치. 기기가 GPS를 안 주거나 참여자가 위치 권한을
    // 거부하면 전부 null로 남고, 그래도 출퇴근은 정상 처리된다.
    // accuracy: 브라우저가 알려주는 GPS 오차 반경(m) — 값이 크면 판정을 신뢰하면 안 된다.
    // inside: 배정 수요처의 관제구역 안이었는지. 좌표가 없거나 수요처/관제구역이
    //         없어서 판정 자체를 못 한 경우도 null이다 (false와 구분해야 한다).
    // distanceM: 가장 가까운 관제구역 중심까지의 거리(m). 관제 반경이 넓어서(최소 1.5km)
    //         inside만으론 자택 출근을 못 걸러내므로, 실제 판별은 이 거리로 한다.
    clockInLat: real("clock_in_lat"),
    clockInLng: real("clock_in_lng"),
    clockInAccuracy: real("clock_in_accuracy"),
    clockInInside: integer("clock_in_inside", { mode: "boolean" }),
    clockInDistanceM: integer("clock_in_distance_m"),
    clockOutLat: real("clock_out_lat"),
    clockOutLng: real("clock_out_lng"),
    clockOutAccuracy: real("clock_out_accuracy"),
    clockOutInside: integer("clock_out_inside", { mode: "boolean" }),
    clockOutDistanceM: integer("clock_out_distance_m"),
    // 이 날 받은 좌표 중 "GPS가 아니라 위치 조작 앱이 주입한 값"으로 표시된 건수.
    // 출근·퇴근·근무 중 보고를 모두 합산한다. 좌표를 근무지로 위조하면 구역 안으로만
    // 찍혀서 이탈 기록이 아예 생기지 않기 때문에, 이탈 로그가 아니라 하루 근태 기록에
    // 누적해야 드러난다.
    //
    // 하이브리드 앱(백그라운드 위치 플러그인)에서만 채워진다 — 브라우저 위치 API는
    // 이 정보를 주지 않아서 웹으로 쓰는 참여자는 항상 0이다. 루팅한 기기는 표시 자체를
    // 숨길 수 있으므로 "0이면 결백"이 아니라 "0보다 크면 확인 필요"로만 읽어야 한다.
    // 개발자 옵션을 다른 목적으로 켜둔 기기도 있으니 자동 판정하지 않고 관리자가 확인한다.
    simulatedCount: integer("simulated_count").notNull().default(0),
  },
  (table) => [
    index("idx_attendance_participant_date").on(table.participantId, table.workDate),
    index("idx_attendance_program_date").on(table.programId, table.workDate),
    // autoClockOut이 매분 "아직 퇴근 안 한 근태"를 찾는 쿼리용 — clockOut이 대부분(마감된
    // 근태) NOT NULL이라 이 인덱스로 열려있는 소수만 바로 골라낸다.
    index("idx_attendance_open").on(table.clockOut, table.workDate),
  ],
);

// 교육 마스터 — 사전/기간중 교육 정의. payMode에 따라 이수 등록 시 지급액 계산 방식이 달라진다.
export const projectTrainings = sqliteTable("project_trainings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id),
  name: text("name").notNull(),
  category: text("category").$type<"PRE" | "DURING">().notNull(),
  isPaid: integer("is_paid", { mode: "boolean" }).notNull().default(false),
  // WORK: 근무시간으로 합산(주휴수당 포함) / HOURLY: 시간×시급 별도지급
  // DAILY: 고정 일당 별도지급 / NONE: 기록만, 급여 미반영
  payMode: text("pay_mode").$type<"WORK" | "HOURLY" | "DAILY" | "NONE">().notNull().default("NONE"),
  hours: real("hours"),
  dailyWage: integer("daily_wage"),
  isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 참여자별 교육 이수 기록. payAmount는 등록 시 교육의 payMode 기준으로 서버가 계산해 저장한다.
export const participantTrainingLogs = sqliteTable(
  "participant_training_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id),
    trainingId: integer("training_id")
      .notNull()
      .references(() => projectTrainings.id),
    attendDate: text("attend_date").notNull(),
    attendHours: real("attend_hours").notNull().default(0),
    payAmount: integer("pay_amount").notNull().default(0),
    status: text("status").$type<"COMPLETED" | "CANCELLED">().notNull().default("COMPLETED"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("idx_participant_training_participant").on(table.participantId)],
);

// 이탈 이벤트 1건 = 배정된 수요처 반경을 벗어난 순간(복귀 후 다시 벗어나면 새 건).
// alertCount는 이 참여자가 해결(RESOLVED) 처리 이후 다시 벗어난 누적 횟수.
export const escapeLogs = sqliteTable(
  "escape_logs",
  {
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
    // 이탈을 판정한 좌표의 GPS 오차 반경(m). 이 값이 크면 이탈 기록 자체의 신뢰도가
    // 낮다는 뜻이라, 나중에 참여자와 다툼이 생겼을 때 판단 근거로 남긴다.
    // 오차 때문에 판정을 보류한 좌표는 애초에 이탈 기록을 만들지 않는다(/public/location).
    accuracyM: real("accuracy_m"),
    alertCount: integer("alert_count").notNull().default(1),
    status: text("status").$type<"OPEN" | "RESOLVED">().notNull().default("OPEN"),
    // 3단계(위급) 팝업을 관제 화면에서 한 번만 띄우기 위한 표시 — 팝업을 띄운 뒤 true로 바꾼다
    alerted: integer("alerted", { mode: "boolean" }).notNull().default(false),
    resolvedBy: integer("resolved_by").references(() => admins.id),
    resolvedAt: text("resolved_at"),
    memo: text("memo"),
  },
  // 관제 화면이 programId + status(OPEN/RESOLVED)로 필터해서 조회함 (programs.ts)
  (table) => [index("idx_escape_program_status").on(table.programId, table.status)],
);

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

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id),
    actDate: text("act_date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    content: text("content"),
    place: text("place"),
    hasAccident: integer("has_accident", { mode: "boolean" }).notNull().default(false),
    accidentDetail: text("accident_detail"),
    accidentAction: text("accident_action"),
    userSignature: text("user_signature"),
    demandSignature: text("demand_signature"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("idx_activity_participant_date").on(table.participantId, table.actDate)],
);
