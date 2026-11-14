import { and, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { adminDevices, adminRefreshTokens, adminSessions } from "../db/schema";
import { generateSessionToken, hashSessionToken, SESSION_TTL_MS } from "./sessionToken";

type DB = ReturnType<typeof drizzle>;

// 관리자 앱 토큰 — 접속 토큰은 PC와 같은 admin_sessions(1시간, 연장 없음)를 Bearer로 쓰고,
// 앱은 그게 끝나면 갱신 토큰(30일)으로 새 접속 토큰을 받는다. 갱신 토큰은 앱 잠금(지문/PIN)을
// 풀어야만 Keystore에서 꺼내지도록 앱 쪽에서 묶는다.
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

export type AdminAppTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

// 같은 폰에서 이어지는 갱신 토큰 묶음 id. 로그인할 때 새로 만들고, 갱신할 때는 이어받는다.
const generateFamilyId = (): string => crypto.randomUUID();

export const issueAdminAppTokens = async (
  db: DB,
  adminId: number,
  familyId: string = generateFamilyId(),
): Promise<AdminAppTokens> => {
  const accessToken = generateSessionToken();
  const accessTokenExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const refreshToken = generateSessionToken();
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

  await db.insert(adminSessions).values({
    adminId,
    tokenHash: await hashSessionToken(accessToken),
    expiresAt: accessTokenExpiresAt,
  });
  await db.insert(adminRefreshTokens).values({
    adminId,
    familyId,
    tokenHash: await hashSessionToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
  });

  return { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt };
};

export type ConsumeRefreshTokenResult =
  | { status: "ok"; adminId: number; familyId: string }
  | { status: "invalid" }
  | { status: "reused" };

// 갱신 토큰을 한 번 쓴 것으로 표시하고 이어받을 familyId를 돌려준다. 새 토큰 발급은
// 호출하는 쪽에서 관리자 계정 상태(비활성 여부)를 확인한 뒤 issueAdminAppTokens로 한다.
export const consumeRefreshToken = async (
  db: DB,
  refreshToken: string,
): Promise<ConsumeRefreshTokenResult> => {
  const nowIso = new Date().toISOString();
  const rows = await db
    .select()
    .from(adminRefreshTokens)
    .where(eq(adminRefreshTokens.tokenHash, await hashSessionToken(refreshToken)));
  const row = rows[0];
  if (!row || row.expiresAt <= nowIso) return { status: "invalid" };

  if (row.usedAt) {
    // 이미 쓴 토큰이 다시 들어왔다 — 원래 폰과 훔친 쪽 중 누가 먼저 썼는지 알 수 없으니
    // 그 묶음을 통째로 끊어 둘 다 다시 로그인하게 한다.
    await db.delete(adminRefreshTokens).where(eq(adminRefreshTokens.familyId, row.familyId));
    return { status: "reused" };
  }

  // usedAt이 비어 있을 때만 찍는다 — 같은 토큰으로 갱신 요청이 동시에 두 번 들어와도
  // 하나만 성공하고 나머지는 reused로 떨어진다.
  const updated = await db
    .update(adminRefreshTokens)
    .set({ usedAt: nowIso })
    .where(and(eq(adminRefreshTokens.id, row.id), isNull(adminRefreshTokens.usedAt)))
    .returning({ id: adminRefreshTokens.id });
  if (updated.length === 0) {
    await db.delete(adminRefreshTokens).where(eq(adminRefreshTokens.familyId, row.familyId));
    return { status: "reused" };
  }

  // 만료된 토큰은 쓸 일이 없으니 이 관리자 것만 같이 정리한다.
  await db
    .delete(adminRefreshTokens)
    .where(
      and(eq(adminRefreshTokens.adminId, row.adminId), lt(adminRefreshTokens.expiresAt, nowIso)),
    );

  return { status: "ok", adminId: row.adminId, familyId: row.familyId };
};

// 앱 로그아웃 — 그 폰의 갱신 토큰 묶음과 FCM 토큰을 지운다.
export const revokeRefreshTokenFamily = async (db: DB, refreshToken: string) => {
  const rows = await db
    .select({ familyId: adminRefreshTokens.familyId })
    .from(adminRefreshTokens)
    .where(eq(adminRefreshTokens.tokenHash, await hashSessionToken(refreshToken)));
  const familyIds = rows.map((row) => row.familyId);
  if (familyIds.length === 0) return;
  await db.delete(adminRefreshTokens).where(inArray(adminRefreshTokens.familyId, familyIds));
};

// 비밀번호 변경·재설정, 계정 비활성화 때 그 관리자의 접속을 끊는다. keepSessionTokenHash를
// 주면(본인이 비밀번호를 바꾼 그 화면) 그 세션 하나만 남긴다. 앱 갱신 토큰은 전부 지우고,
// 비활성화처럼 알림도 그만 받아야 하면 removeDevices로 FCM 토큰까지 지운다.
export const revokeAdminAccess = async (
  db: DB,
  adminId: number,
  options: { keepSessionTokenHash?: string; removeDevices?: boolean } = {},
) => {
  await db
    .delete(adminSessions)
    .where(
      options.keepSessionTokenHash
        ? and(
            eq(adminSessions.adminId, adminId),
            ne(adminSessions.tokenHash, options.keepSessionTokenHash),
          )
        : eq(adminSessions.adminId, adminId),
    );
  await db.delete(adminRefreshTokens).where(eq(adminRefreshTokens.adminId, adminId));
  if (options.removeDevices) {
    await db.delete(adminDevices).where(eq(adminDevices.adminId, adminId));
  }
};
