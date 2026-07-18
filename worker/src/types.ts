export type AdminRole = "SUPER_ADMIN" | "AGENCY_ADMIN" | "SUB_ADMIN" | "MANAGER";

export type AdminSession = {
  id: number;
  email: string;
  role: AdminRole;
  organizationId: number | null;
  programIds: number[];
  groupIds: number[];
};

export type Env = {
  Bindings: {
    DB: D1Database;
    VAPID_PRIVATE_KEY: string;
    VAPID_SUBJECT: string;
    DISASTER_API_KEY: string;
    // Cloudflare Zero Trust 대시보드 > Settings > Custom Pages 상단에 표시되는 팀 도메인
    // (예: your-team.cloudflareaccess.com)과, 이 Worker를 보호하는 Access
    // Application의 Audience(AUD) 태그.
    CF_ACCESS_TEAM_DOMAIN: string;
    CF_ACCESS_AUD: string;
  };
  Variables: {
    admin: AdminSession;
  };
};
