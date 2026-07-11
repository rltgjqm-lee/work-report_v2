import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";

import auth from "./routes/auth";
import organizations from "./routes/organizations";
import programs from "./routes/programs";
import publicRoutes from "./routes/public";
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

app.route("/login", auth);
app.route("/public", publicRoutes);

app.use("/api/*", (c, next) =>
  jwt({ secret: c.env.JWT_SECRET, alg: "HS256" })(c, next),
);

app.route("/api/organizations", organizations);
app.route("/api/programs", programs);

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
