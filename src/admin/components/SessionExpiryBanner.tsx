import { useMutation, useQueryClient } from "@tanstack/react-query";

import { extendSessionMutationOptions } from "../api/admin/me";

// 만료 5분 전부터 노출한다 — 그 전엔 배너 없이 topbar 카운트다운만 보인다.
const WARNING_THRESHOLD_MS = 5 * 60 * 1000;

interface SessionExpiryBannerProps {
  expiresAt: string;
  now: number;
}

/**
 * 관리자 세션 만료가 임박했을 때(5분 전부터) 상단에 계속 떠 있는 배너입니다.
 * 토스트(ToastContext)는 몇 초 뒤 자동으로 사라지는 일회성 알림용이라, 만료까지
 * 계속 보여주면서 연장 버튼을 눌러야 하는 이 상황엔 안 맞아서 별도로 둔다.
 */
const SessionExpiryBanner = ({ expiresAt, now }: SessionExpiryBannerProps) => {
  const queryClient = useQueryClient();
  const extendSessionMutation = useMutation(extendSessionMutationOptions(queryClient));

  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0 || remainingMs > WARNING_THRESHOLD_MS) return null;

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  return (
    <div className="flex items-center justify-between gap-4 px-8 py-2.5 bg-admin-status-warn-bg text-admin-status-warn-text text-[13px] font-semibold border-b border-admin-border-subtle">
      <span>
        세션이 {minutes}분 {String(seconds).padStart(2, "0")}초 후 만료됩니다.
      </span>
      <button
        onClick={() => extendSessionMutation.mutate()}
        disabled={extendSessionMutation.isPending}
        className="text-admin-status-warn-text font-bold underline bg-transparent border-none cursor-pointer disabled:opacity-50"
      >
        {extendSessionMutation.isPending ? "연장 중..." : "연장하기"}
      </button>
    </div>
  );
};

export default SessionExpiryBanner;
