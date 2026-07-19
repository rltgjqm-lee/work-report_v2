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
    // 로컬 wrangler dev 전용 — CF Access 터널 없이 관리자 콘솔을 테스트하기 위한 바이패스.
    // .dev.vars에만 설정하고, 배포 환경 시크릿에는 절대 넣지 않는다.
    LOCAL_ADMIN_BYPASS_EMAIL?: string;
  };
  Variables: {
    admin: AdminSession;
  };
};
