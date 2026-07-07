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
  };
  Variables: {
    jwtPayload: JwtPayload;
  };
};
