import { Hono } from "hono";
import { cors } from "hono/cors";

import organizations from "./routes/organizations";
import programs from "./routes/programs";
import groups from "./routes/groups";
import participants from "./routes/participants";
import excel from "./routes/excel";
import safetyAlerts from "./routes/safetyAlerts";
import disasterPushLogs from "./routes/disasterPushLogs";
import admins from "./routes/admins";
import demandSites from "./routes/demandSites";
import escapes from "./routes/escapes";
import publicRoutes from "./routes/public";
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import { requireAdmin } from "./lib/authz";
import { checkDisasterAlerts } from "./scheduled/checkDisasterAlerts";
import { checkSignalLoss } from "./scheduled/checkSignalLoss";
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

export default {
  fetch: app.fetch,
  scheduled: async (
    _event: ScheduledEvent,
    env: Env["Bindings"],
    ctx: ExecutionContext,
  ) => {
    ctx.waitUntil(checkDisasterAlerts(env));
    ctx.waitUntil(checkSignalLoss(env));
  },
};
