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
import meRoutes from "./routes/admin/me";
import organizations from "./routes/admin/organizations";
import otaBundles from "./routes/admin/otaBundles";
import participants from "./routes/admin/participants";
import programs from "./routes/admin/programs";
import safetyAlerts from "./routes/admin/safetyAlerts";
import trainings from "./routes/admin/trainings";
import otaPublicRoutes from "./routes/user/ota";
import publicRoutes from "./routes/user/public";
import { autoClockOut } from "./scheduled/autoClockOut";
import { checkDisasterAlerts } from "./scheduled/checkDisasterAlerts";
import { checkSignalLoss } from "./scheduled/checkSignalLoss";
import { returnFromLeave } from "./scheduled/returnFromLeave";
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
app.route("/api/escapes", escapes);
app.route("/api/attendance", attendance);
app.route("/api/trainings", trainings);
app.route("/api/ota-bundles", otaBundles);

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env["Bindings"], ctx: ExecutionContext) => {
    ctx.waitUntil(checkDisasterAlerts(env));
    ctx.waitUntil(checkSignalLoss(env));
    ctx.waitUntil(returnFromLeave(env));
    ctx.waitUntil(autoClockOut(env));
  },
};
