export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ORGANIZATION_ADMIN: "ORGANIZATION_ADMIN",
  SUB_ADMIN: "SUB_ADMIN",
  MANAGER: "MANAGER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type AdminSession = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  organizationId: number | null;
  programIds: number[];
  groupIds: number[];
  expiresAt: string;
};

export type Admin = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  organizationId: number | null;
  programIds: number[];
  groupIds: number[];
  isActive: boolean;
  createdAt: string;
};

// 목록 화면(관리자 계정)용 — 프론트가 find로 붙이지 않도록 기관명을 서버가 조인해 같이 내려준다.
export type AdminListItem = Admin & { organizationName: string | null };
