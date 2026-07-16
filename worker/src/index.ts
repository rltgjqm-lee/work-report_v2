import { Hono } from "hono";
import { cors } from "hono/cors";

import organizations from "./routes/organizations";
import programs from "./routes/programs";
import groups from "./routes/groups";
import participants from "./routes/participants";
import excel from "./routes/excel";
import safetyAlerts from "./routes/safetyAlerts";
import publicRoutes from "./routes/public";
import { requireAdmin, getAuth } from "./lib/authz";
import { checkDisasterAlerts } from "./scheduled/checkDisasterAlerts";
import type { Env } from "./types";

const app = new Hono<Env>();

app.use(
  "*",
  cors({
    origin: "*",
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

export default {
  fetch: app.fetch,
  scheduled: async (
    _event: ScheduledEvent,
    env: Env["Bindings"],
    ctx: ExecutionContext,
  ) => {
    ctx.waitUntil(checkDisasterAlerts(env));
  },
};
