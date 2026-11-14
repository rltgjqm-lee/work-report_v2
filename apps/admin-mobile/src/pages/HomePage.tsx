import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ChevronRight, CircleCheck, MapPinned } from "lucide-react";

import {
  mobileHomeQueryOptions,
  mobileSafetyQueryOptions,
} from "@work-report/admin-core/api/mobile";

import { useSession } from "../context/useSession";

import Card from "../components/atoms/Card";
import StatusChip from "../components/atoms/StatusChip";
import HeaderStats from "../components/molecule/HeaderStats";
import {
  formatClock,
  formatElapsedSince,
  formatMeters,
  formatToday,
  useNow,
  zoneBadgeText,
} from "../lib/format";

const HomePage = () => {
  const now = useNow();
  const { profile } = useSession();
  const { data: safety, isPending: isSafetyPending } = useQuery(mobileSafetyQueryOptions);
  const { data: home } = useQuery(mobileHomeQueryOptions);

  const openSosList = safety?.sos.filter((sos) => sos.status === "OPEN") ?? [];
  const openEscapes = safety?.escapes.filter((escape) => escape.status === "OPEN") ?? [];
  const recentResolved = [
    ...(safety?.sos ?? [])
      .filter((sos) => sos.status === "RESOLVED" && sos.resolvedAt)
      .map((sos) => ({
        key: `sos-${sos.id}`,
        kind: "SOS" as const,
        path: `/sos?id=${sos.id}`,
        name: sos.participantName,
        memo: sos.memo,
        resolvedAt: sos.resolvedAt as string,
      })),
    ...(safety?.escapes ?? [])
      .filter((escape) => escape.status === "RESOLVED" && escape.resolvedAt)
      .map((escape) => ({
        key: `escape-${escape.id}`,
        kind: "이탈" as const,
        path: `/escape?id=${escape.id}`,
        name: escape.participantName,
        memo: escape.memo,
        resolvedAt: escape.resolvedAt as string,
      })),
  ]
    .sort((left, right) => right.resolvedAt.localeCompare(left.resolvedAt))
    .slice(0, 3);
  const hasOpenItems = openSosList.length + openEscapes.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-none flex-col gap-[18px] bg-accent px-5 pt-4 pb-6">
        <span className="flex items-center gap-2 text-base font-extrabold tracking-wide text-white">
          <img src="./app-icon.png" alt="" className="h-6 w-6 rounded-lg" />
          WORK SAFE 관리자
        </span>
        <div>
          <h1 className="text-[26px] font-extrabold text-white">{profile?.name ?? "담당자"}님</h1>
          <p className="mt-1.5 text-sm font-semibold text-white/85">
            {[home?.organizationName ?? profile?.organizationName, formatToday(now)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <HeaderStats
          stats={[
            { label: "미처리 SOS", value: safety ? `${openSosList.length}건` : "–" },
            { label: "지금 이탈", value: safety ? `${openEscapes.length}명` : "–" },
            { label: "오늘 출근", value: home ? `${home.todayClockInCount}명` : "–" },
          ]}
        />
      </header>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <Card className="flex flex-col gap-3 p-[18px]">
          <div className="flex items-center justify-between gap-2.5">
            <h2 className="text-base font-extrabold text-ink">확인이 필요해요</h2>
            <Link to="/safety" className="text-[13px] font-extrabold text-accent">
              안전 탭에서 보기 ›
            </Link>
          </div>
          {isSafetyPending ? (
            <p className="py-6 text-center text-sm font-bold text-ink-muted">불러오는 중...</p>
          ) : hasOpenItems ? (
            <>
              {openSosList.map((sos) => (
                <Link
                  key={`sos-${sos.id}`}
                  to={`/sos?id=${sos.id}`}
                  className="flex items-center gap-3 rounded-[14px] bg-sos-soft px-4 py-3.5"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-sos text-xs font-black text-white">
                    SOS
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-extrabold text-ink">
                      SOS {sos.participantName} · {formatElapsedSince(sos.triggeredAt, now)} 전
                    </span>
                    <span className="truncate text-[13px] font-bold text-sos-ink">
                      {sos.demandSiteName ?? sos.programName} · {zoneBadgeText(sos.outsideM)}
                    </span>
                  </span>
                  <ChevronRight size={20} className="flex-none text-sos-ink" aria-hidden="true" />
                </Link>
              ))}
              {openEscapes.map((escape) => (
                <Link
                  key={`escape-${escape.id}`}
                  to={`/escape?id=${escape.id}`}
                  className="flex items-center gap-3 rounded-[14px] bg-escape-soft px-4 py-3.5"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-escape text-xs font-black text-white">
                    이탈
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-extrabold text-ink">
                      이탈 {escape.participantName} ·{" "}
                      {formatMeters(escape.currentOutsideM ?? escape.detectedOutsideM)} ·{" "}
                      {formatElapsedSince(escape.detectedAt, now)}
                    </span>
                    <span className="truncate text-[13px] font-bold text-escape-ink">
                      {escape.demandSiteName ?? escape.programName} 구역
                    </span>
                  </span>
                  <ChevronRight
                    size={20}
                    className="flex-none text-escape-ink"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 pt-5 pb-3.5">
              <CircleCheck size={52} className="text-ok" strokeWidth={1.8} aria-hidden="true" />
              <span className="mt-1 text-[17px] font-extrabold text-ink">지금은 모두 안전해요</span>
              <span className="text-[13px] font-bold text-ink-muted">
                새 SOS가 생기면 바로 알려드릴게요
              </span>
            </div>
          )}
        </Card>

        <Link to="/zones">
          <Card className="flex items-center gap-3.5 px-[18px] py-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent/10 text-accent">
              <MapPinned size={22} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-base font-extrabold text-ink">관제 구역</span>
              <span className="text-[13px] font-bold text-ink-muted">
                관제 중 {home?.zoneCount ?? "–"}곳 ·{" "}
                <span className={home?.escapeZoneCount ? "text-escape-ink" : ""}>
                  이탈 발생 {home?.escapeZoneCount ?? "–"}곳
                </span>
              </span>
            </span>
            <ChevronRight size={20} className="flex-none text-ink-faint" aria-hidden="true" />
          </Card>
        </Link>

        <h2 className="mt-1 text-lg font-extrabold text-ink">최근 처리</h2>
        <Card className="flex flex-col px-[18px] py-1.5">
          {recentResolved.length === 0 ? (
            <p className="py-5 text-center text-sm font-bold text-ink-muted">
              최근 7일 동안 처리한 건이 없어요
            </p>
          ) : (
            recentResolved.map((item) => (
              <Link
                key={item.key}
                to={item.path}
                className="flex items-center gap-3 border-b-[1.5px] border-soft py-3.5 last:border-b-0"
              >
                <StatusChip tone={item.kind === "SOS" ? "sos" : "escape"}>{item.kind}</StatusChip>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold text-ink">{item.name}</span>
                  <span className="truncate text-[13px] font-bold text-ink-muted">
                    {item.memo || "메모 없음"}
                  </span>
                </span>
                <span className="flex-none text-[13px] font-bold text-ink-muted">
                  {formatClock(item.resolvedAt, now)}
                </span>
              </Link>
            ))
          )}
        </Card>
      </div>
    </div>
  );
};

export default HomePage;
