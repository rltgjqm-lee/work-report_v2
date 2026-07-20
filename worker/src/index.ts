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
import { requireAdmin, getAuth } from "./lib/authz";
import { checkDisasterAlerts } from "./scheduled/checkDisasterAlerts";
import { checkSignalLoss } from "./scheduled/checkSignalLoss";
import type { Env } from "./types";

const app = new Hono<Env>();

app.use(
  "*",
  cors({
    // 관리자 콘솔이 credentials: "include"로 요청을 보내므로, 와일드카드 origin은
    // 브라우저가 credentialed 응답을 차단한다 — 요청 origin을 그대로 반사해준다.
    origin: (origin) => origin,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.route("/public", publicRoutes);

app.use("/api/*", requireAdmin);

app.get("/api/me", (c) => c.json(getAuth(c)));

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
