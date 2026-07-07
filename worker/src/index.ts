import { Hono } from "hono";
import { jwt } from "hono/jwt";

import auth from "./routes/auth";
import organizations from "./routes/organizations";
import programs from "./routes/programs";
import type { Env } from "./types";

const app = new Hono<Env>();

app.route("/login", auth);

app.use("/api/*", (c, next) =>
  jwt({ secret: c.env.JWT_SECRET, alg: "HS256" })(c, next),
);

app.route("/api/organizations", organizations);
app.route("/api/programs", programs);

export default app;
