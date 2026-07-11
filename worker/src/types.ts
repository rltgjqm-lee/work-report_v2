export type JwtPayload = {
  sub: number;
  username: string;
  role: "super_admin" | "org_admin";
  organizationId: number | null;
  exp: number;
};

export type Env = {
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
    VAPID_PRIVATE_KEY: string;
    VAPID_SUBJECT: string;
    DISASTER_API_KEY: string;
  };
  Variables: {
    jwtPayload: JwtPayload;
  };
};
