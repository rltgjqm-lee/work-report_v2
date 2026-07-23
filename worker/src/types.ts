export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ORGANIZATION_ADMIN: "ORGANIZATION_ADMIN",
  SUB_ADMIN: "SUB_ADMIN",
  MANAGER: "MANAGER",
} as const;

export type AdminRole = (typeof ROLES)[keyof typeof ROLES];

export type AdminSession = {
  id: number;
  email: string;
  name: string | null;
  role: AdminRole;
  organizationId: number | null;
  programIds: number[];
  groupIds: number[];
};

export type Env = {
  Bindings: {
    DB: D1Database;
    SIGNATURES_BUCKET: R2Bucket;
    VAPID_PRIVATE_KEY: string;
    VAPID_SUBJECT: string;
    DISASTER_API_KEY: string;
    // 쿠키 기반 세션에 credentials를 포함한 CORS를 허용할 origin 콤마구분 목록
    // (wrangler.jsonc의 vars 참고).
    ALLOWED_ORIGINS: string;
  };
  Variables: {
    admin: AdminSession;
  };
};
