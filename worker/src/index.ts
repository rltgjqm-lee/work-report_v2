import { Hono } from "hono";
import { cors } from "hono/cors";

import { requireAdmin } from "./lib/authz";
import admins from "./routes/admin/admins";
import attendance from "./routes/admin/attendance";
import authRoutes from "./routes/admin/auth";
import demandSites from "./routes/admin/demandSites";
import disasterPushLogs from "./routes/admin/disasterPushLogs";
import escapes from "./routes/admin/escapes";
import excel from "./routes/admin/excel";
import groups from "./routes/admin/groups";
import locationTraces from "./routes/admin/locationTraces";
import meRoutes from "./routes/admin/me";
import organizations from "./routes/admin/organizations";
import otaBundles from "./routes/admin/otaBundles";
import participants from "./routes/admin/participants";
import programActivityOptions from "./routes/admin/programActivityOptions";
import programs from "./routes/admin/programs";
import safetyAlerts from "./routes/admin/safetyAlerts";
import sos from "./routes/admin/sos";
import trainings from "./routes/admin/trainings";
import otaPublicRoutes from "./routes/user/ota";
import publicRoutes from "./routes/user/public";
import { autoClockOut } from "./scheduled/autoClockOut";
import { checkDisasterAlerts } from "./scheduled/checkDisasterAlerts";
import { checkSignalLoss } from "./scheduled/checkSignalLoss";
import { refreshLeaveStatuses } from "./scheduled/refreshLeaveStatuses";
import type { Env } from "./types";

const app = new Hono<Env>();

app.use(
  "*",
  cors({
    // 인증이 쿠키 기반이라, origin을 아무거나 반사하면 브라우저가 어느 사이트에서든
    // credentials 포함 요청을 보낼 수 있게 된다(악성 사이트가 관리자 세션 쿠키를
    // 실어 API를 호출하고 응답까지 읽어갈 수 있음) — ALLOWED_ORIGINS 화이트리스트에
    // 있는 origin만 반사한다.
    origin: (origin, c) => {
      const allowedOrigins: string[] = c.env.ALLOWED_ORIGINS.split(",").map(
        (allowedOrigin: string) => allowedOrigin.trim(),
      );
      return allowedOrigins.includes(origin) ? origin : "";
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.route("/public", publicRoutes);
app.route("/public/ota", otaPublicRoutes);
app.route("/auth", authRoutes);

app.use("/api/*", requireAdmin);

app.route("/api/me", meRoutes);
app.route("/api/organizations", organizations);
app.route("/api/programs", programs);
app.route("/api/programs", excel);
app.route("/api/groups", groups);
app.route("/api/participants", participants);
app.route("/api/safety-alerts", safetyAlerts);
app.route("/api/disaster-push-logs", disasterPushLogs);
app.route("/api/admins", admins);
app.route("/api/demand-sites", demandSites);
app.route("/api/program-activity-options", programActivityOptions);
app.route("/api/escapes", escapes);
app.route("/api/sos", sos);
app.route("/api/attendance", attendance);
app.route("/api/trainings", trainings);
app.route("/api/ota-bundles", otaBundles);
app.route("/api/location-traces", locationTraces);

// KST 18:01~18:15 — 18:00에 끝나는 조의 자동퇴근 유예가 이 사이에 끝난다. 재난문자
// 폴링(하루 호출 한도)·통신 끊김 감지 등은 근무시간(~18:00)까지만 돌면 되므로 이
// 구간엔 자동퇴근만 돌린다. wrangler.jsonc의 crons와 같은 문자열이어야 한다.
const AUTO_CLOCK_OUT_ONLY_CRON = "1-15 9 * * *";

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env["Bindings"], ctx: ExecutionContext) => {
    if (event.cron === AUTO_CLOCK_OUT_ONLY_CRON) {
      ctx.waitUntil(autoClockOut(env));
      return;
    }
    ctx.waitUntil(checkDisasterAlerts(env));
    ctx.waitUntil(checkSignalLoss(env));
    ctx.waitUntil(refreshLeaveStatuses(env));
    ctx.waitUntil(autoClockOut(env));
  },
};
